import { Codex } from "@openai/codex-sdk";

import { resolveCodexExecutable } from "./app-server-client";

export interface CodexExecutionResult {
  finalResponse: string;
  threadId: string;
}

export interface CodexTaskExecutorOptions {
  codexPath?: string;
  workingDirectory: string;
  timeoutMs?: number;
}

export class CodexTaskExecutor {
  constructor(private readonly options: CodexTaskExecutorOptions) {}

  async verifyExecution(): Promise<CodexExecutionResult> {
    const executablePath = await resolveCodexExecutable(this.options.codexPath);
    const codex = new Codex({ codexPathOverride: executablePath });
    const thread = codex.startThread({
      workingDirectory: this.options.workingDirectory,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.options.timeoutMs ?? 240_000);
    try {
      const turn = await thread.run(
        "Reply with exactly WORKBENCH_CODEX_OK. Do not use tools, access the network, or modify files.",
        { signal: abortController.signal },
      );
      if (!thread.id) throw new Error("Codex SDK completed without a thread ID");
      if (!turn.finalResponse.includes("WORKBENCH_CODEX_OK")) {
        throw new Error(
          `Codex SDK returned an unexpected response: ${turn.finalResponse.slice(0, 160)}`,
        );
      }
      return { finalResponse: turn.finalResponse, threadId: thread.id };
    } finally {
      clearTimeout(timeout);
    }
  }
}
