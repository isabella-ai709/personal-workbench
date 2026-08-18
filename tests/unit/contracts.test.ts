import { describe, expect, it } from "vitest";

import { apiErrorSchema, paginatedSchema, skillSummarySchema } from "../../src/shared/contracts";
import { createTaskPlanInputSchema, taskPlanSchema } from "../../src/shared/task-plan-contracts";

describe("shared API contracts", () => {
  it("normalizes valid task plan creation input", () => {
    const task = createTaskPlanInputSchema.parse({ title: "  每日复盘  " });

    expect(task.title).toBe("每日复盘");
    expect(task).toMatchObject({ type: "todo", status: "pending", priority: "medium" });
  });

  it("rejects malformed task plan records at the transport boundary", () => {
    expect(taskPlanSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(createTaskPlanInputSchema.safeParse({ title: "", type: "unknown" }).success).toBe(false);
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
