import { describe, expect, it } from "vitest";

import {
  apiErrorSchema,
  createTaskInputSchema,
  paginatedSchema,
  skillSummarySchema,
  taskRunSchema,
} from "../../src/shared/contracts";

describe("shared API contracts", () => {
  it("normalizes valid task creation input", () => {
    const task = createTaskInputSchema.parse({
      name: "  每日复盘  ",
      prompt: "总结当天任务",
      schedule: { cron: "0 21 * * *", timezone: "Asia/Shanghai" },
    });

    expect(task.name).toBe("每日复盘");
    expect(task.enabled).toBe(true);
  });

  it("rejects malformed run records at the transport boundary", () => {
    expect(taskRunSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);

    const inconsistentRun = taskRunSchema.safeParse({
      id: "10000000-0000-4000-8000-000000000001",
      taskId: "10000000-0000-4000-8000-000000000002",
      status: "running",
      trigger: "manual",
      scheduledFor: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      resultPreview: null,
      errorCode: null,
      errorMessage: null,
      codexThreadId: null,
      hasFullLog: false,
      retriedFromRunId: null,
      createdAt: "2026-08-17T10:00:00.000Z",
    });
    expect(inconsistentRun.success).toBe(false);
  });

  it("represents Skills with opaque ids instead of writeable paths", () => {
    const skill = skillSummarySchema.parse({
      id: "a1b2c3d4e5f6g7h8",
      name: "example",
      description: "Example Skill",
      scope: "user",
      origin: "unconfirmed",
      enabled: true,
      stale: false,
      deletable: false,
      location: "用户 Skill",
    });
    expect(skill.id).toBe("a1b2c3d4e5f6g7h8");
  });

  it("validates paginated results and stable API errors", () => {
    expect(paginatedSchema(skillSummarySchema).parse({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(
      apiErrorSchema.parse({ error: { code: "NOT_FOUND", message: "Task not found" } }),
    ).toEqual({ error: { code: "NOT_FOUND", message: "Task not found" } });
  });
});
