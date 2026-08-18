import { describe, expect, it } from "vitest";

import type { TaskPlan } from "../../src/shared/task-plan-contracts";
import { getFocusGroup } from "../../src/shared/task-plan-groups";

const now = new Date("2026-08-18T01:00:00.000Z");
const base: TaskPlan = {
  id: "10000000-0000-4000-8000-000000000001",
  type: "todo",
  title: "测试事项",
  status: "pending",
  priority: "medium",
  dueAt: null,
  nextAction: "",
  notes: "",
  completedAt: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  deletedAt: null,
};

describe("task plan focus groups", () => {
  it("uses Asia/Shanghai calendar dates and the confirmed priority order", () => {
    expect(getFocusGroup({ ...base, dueAt: "2026-08-17T15:59:59.000Z" }, now)).toBe(
      "past_plan_time",
    );
    expect(getFocusGroup({ ...base, dueAt: "2026-08-17T16:00:00.000Z" }, now)).toBe("today");
    expect(getFocusGroup({ ...base, status: "blocked" }, now)).toBe("blocked");
    expect(getFocusGroup({ ...base, dueAt: "2026-08-24T03:00:00.000Z" }, now)).toBe(
      "next_seven_days",
    );
    expect(getFocusGroup(base, now)).toBe("later");
  });

  it("excludes ideas, completed items, and deleted items", () => {
    expect(getFocusGroup({ ...base, type: "idea" }, now)).toBeNull();
    expect(
      getFocusGroup({ ...base, status: "completed", completedAt: now.toISOString() }, now),
    ).toBeNull();
    expect(getFocusGroup({ ...base, deletedAt: now.toISOString() }, now)).toBeNull();
  });
});
