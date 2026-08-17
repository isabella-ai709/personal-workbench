import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { Codex, type ThreadOptions } from "@openai/codex-sdk";

import type { Task, TaskRun } from "../../../shared/contracts";
import {
  TaskExecutionError,
  type ScheduledTaskExecutor,
  type TaskExecutionResult,
} from "../../modules/tasks/task-scheduler";
import { resolveCodexExecutable } from "./app-server-client";
import { redactText } from "./redact";

export interface CodexExecutionResult {
  finalResponse: string;
  threadId: string;
}

interface CodexTurnLike {
  finalResponse: string;
}

interface CodexThreadLike {
  readonly id: string | null;
  run(input: string, options?: { signal?: AbortSignal }): Promise<CodexTurnLike>;
}

interface CodexClientLike {
  startThread(options?: ThreadOptions): CodexThreadLike;
}

export interface CodexTaskExecutorOptions {
  codexPath?: string;
  workingDirectory: string;
  logsDirectory?: string;
  timeoutMs?: number;
  environment?: NodeJS.ProcessEnv;
  createClient?: (executablePath: string) => CodexClientLike;
}

interface RunLogEntry {
  timestamp: string;
  event: "started" | "completed" | "failed";
  taskId: string;
  runId: string;
  threadId?: string;
  response?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class CodexTaskExecutor implements ScheduledTaskExecutor {
  constructor(private readonly options: CodexTaskExecutorOptions) {}

  async execute(task: Task, run: TaskRun, signal?: AbortSignal): Promise<TaskExecutionResult> {
    const logsDirectory = this.options.logsDirectory ?? join(this.options.workingDirectory, "logs");
    const logPath = join(logsDirectory, `${run.id}.jsonl`);
    let thread: CodexThreadLike | undefined;
    let logReady = false;
    try {
      await mkdir(logsDirectory, { recursive: true });
      logReady = true;
      await this.writeLog(logPath, {
        timestamp: new Date().toISOString(),
        event: "started",
        taskId: task.id,
        runId: run.id,
      });
      thread = await this.createThread();
      const turn = await this.runWithTimeout(thread, task.prompt, signal);
      if (!thread.id)
        throw new TaskExecutionError("PROCESS_FAILED", "Codex completed without a thread ID");
      const response = redactText(turn.finalResponse, this.options.environment);
      await this.writeLog(logPath, {
        timestamp: new Date().toISOString(),
        event: "completed",
        taskId: task.id,
        runId: run.id,
        threadId: thread.id,
        response,
      });
      return {
        resultPreview: response.slice(0, 4_000),
        codexThreadId: thread.id,
        logPath,
      };
    } catch (error) {
      const classified = this.classifyError(error, signal?.aborted === true);
      if (logReady) {
        try {
          await this.writeLog(logPath, {
            timestamp: new Date().toISOString(),
            event: "failed",
            taskId: task.id,
            runId: run.id,
            ...(thread?.id ? { threadId: thread.id } : {}),
            errorCode: classified.code,
            errorMessage: redactText(classified.message, this.options.environment),
          });
        } catch {
          // The stable classified error remains more useful than masking it with a second log I/O error.
        }
      }
      throw new TaskExecutionError(
        classified.code,
        classified.message,
        classified.runStatus,
        logReady ? logPath : null,
      );
    }
  }

  async verifyExecution(): Promise<CodexExecutionResult> {
    const thread = await this.createThread();
    const turn = await this.runWithTimeout(
      thread,
      "Reply with exactly WORKBENCH_CODEX_OK. Do not use tools, access the network, or modify files.",
    );
    if (!thread.id) throw new Error("Codex SDK completed without a thread ID");
    if (!turn.finalResponse.includes("WORKBENCH_CODEX_OK")) {
      throw new Error(
        `Codex SDK returned an unexpected response: ${turn.finalResponse.slice(0, 160)}`,
      );
    }
    return { finalResponse: turn.finalResponse, threadId: thread.id };
  }

  private async createThread(): Promise<CodexThreadLike> {
    const executablePath = await resolveCodexExecutable(this.options.codexPath);
    const client = this.options.createClient
      ? this.options.createClient(executablePath)
      : new Codex({ codexPathOverride: executablePath });
    return client.startThread({
      workingDirectory: this.options.workingDirectory,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });
  }

  private async runWithTimeout(
    thread: CodexThreadLike,
    prompt: string,
    externalSignal?: AbortSignal,
  ): Promise<CodexTurnLike> {
    const abortController = new AbortController();
    let timedOut = false;
    const cancel = () => abortController.abort();
    if (externalSignal?.aborted) {
      throw new TaskExecutionError("CANCELLED", "Task execution was cancelled", "cancelled");
    }
    externalSignal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, this.options.timeoutMs ?? 240_000);
    try {
      return await thread.run(prompt, { signal: abortController.signal });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new TaskExecutionError("CANCELLED", "Task execution was cancelled", "cancelled");
      }
      if (timedOut) throw new TaskExecutionError("TIMEOUT", "Task execution timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", cancel);
    }
  }

  private classifyError(error: unknown, externallyCancelled: boolean): TaskExecutionError {
    if (error instanceof TaskExecutionError) return error;
    if (externallyCancelled) {
      return new TaskExecutionError("CANCELLED", "Task execution was cancelled", "cancelled");
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      /\b(?:401|403|unauthori[sz]ed|authentication|not logged in|login required)\b/i.test(message)
    ) {
      return new TaskExecutionError("AUTHENTICATION_FAILED", "Codex authentication failed");
    }
    return new TaskExecutionError("PROCESS_FAILED", "Codex task execution failed");
  }

  private async writeLog(path: string, entry: RunLogEntry): Promise<void> {
    const safeEntry = JSON.parse(
      redactText(JSON.stringify(entry), this.options.environment),
    ) as RunLogEntry;
    await appendFile(path, `${JSON.stringify(safeEntry)}\n`, "utf8");
  }
}
