import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CodexTaskExecutor } from "../../src/server/integrations/codex/codex-task-executor";
import type { Task, TaskRun } from "../../src/shared/contracts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
      ),
  );
});

const task: Task = {
  id: "10000000-0000-4000-8000-000000000201",
  name: "Safe execution",
  prompt: "Return a result",
  schedule: { cron: "0 * * * *", timezone: "UTC" },
  enabled: true,
  nextRunAt: null,
  createdAt: "2026-08-17T10:00:00.000Z",
  updatedAt: "2026-08-17T10:00:00.000Z",
  deletedAt: null,
};
const run: TaskRun = {
  id: "10000000-0000-4000-8000-000000000202",
  taskId: task.id,
  status: "running",
  trigger: "manual",
  scheduledFor: null,
  startedAt: "2026-08-17T10:00:00.000Z",
  finishedAt: null,
  durationMs: null,
  resultPreview: null,
  errorCode: null,
  errorMessage: null,
  codexThreadId: null,
  hasFullLog: false,
  retriedFromRunId: null,
  createdAt: "2026-08-17T10:00:00.000Z",
};

describe("CodexTaskExecutor", () => {
  it("persists only redacted responses and returns a safe preview", async () => {
    const directory = await mkdtemp(join(tmpdir(), "workbench-executor-test-"));
    directories.push(directory);
    const secret = "environment-secret-123";
    const executor = new CodexTaskExecutor({
      codexPath: process.execPath,
      workingDirectory: directory,
      logsDirectory: join(directory, "logs"),
      environment: { TEST_SECRET: secret },
      createClient: () => ({
        startThread: () => ({
          id: "thread-test",
          run: async () => ({
            finalResponse: `Finished with ${secret} and sk-proj-abcdefghijklmnopqrstuvwxyz`,
          }),
        }),
      }),
    });

    const result = await executor.execute(task, run);
    const log = await readFile(result.logPath!, "utf8");

    expect(result.resultPreview).toContain("[REDACTED]");
    expect(result.resultPreview).not.toContain(secret);
    expect(log).not.toContain(secret);
    expect(log).not.toContain("sk-proj-");
    expect(result.codexThreadId).toBe("thread-test");
  });

  it("classifies timeout and authentication failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "workbench-executor-test-"));
    directories.push(directory);
    const timeoutExecutor = new CodexTaskExecutor({
      codexPath: process.execPath,
      workingDirectory: directory,
      timeoutMs: 5,
      createClient: () => ({
        startThread: () => ({
          id: null,
          run: (_prompt, options) =>
            new Promise((_resolve, reject) => {
              options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
                once: true,
              });
            }),
        }),
      }),
    });
    await expect(timeoutExecutor.execute(task, run)).rejects.toMatchObject({ code: "TIMEOUT" });

    const authExecutor = new CodexTaskExecutor({
      codexPath: process.execPath,
      workingDirectory: directory,
      createClient: () => ({
        startThread: () => ({
          id: null,
          run: async () => {
            throw new Error("401 unauthorized");
          },
        }),
      }),
    });
    await expect(
      authExecutor.execute(task, { ...run, id: "10000000-0000-4000-8000-000000000203" }),
    ).rejects.toEqual(expect.objectContaining({ code: "AUTHENTICATION_FAILED" }));
  });
});
