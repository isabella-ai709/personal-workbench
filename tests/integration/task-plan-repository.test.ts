import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { TaskPlanRepository } from "../../src/server/modules/task-plans/task-plan-repository";

const now = "2026-08-18T01:00:00.000Z";

describe("TaskPlanRepository", () => {
  it("creates, completes, restores to pending, soft deletes, and restores an item", () => {
    const database = openDatabase(":memory:");
    migrateDatabase(database);
    const repository = new TaskPlanRepository(database, () => now);
    const created = repository.create(
      {
        type: "todo",
        title: "整理本周重点",
        status: "pending",
        priority: "high",
        dueAt: null,
        nextAction: "列出三个重点",
        notes: "",
      },
      "10000000-0000-4000-8000-000000000001",
    );

    expect(created.completedAt).toBeNull();
    expect(repository.update(created.id, { status: "completed" }).completedAt).toBe(now);
    expect(repository.update(created.id, { status: "pending" }).completedAt).toBeNull();
    expect(repository.softDelete(created.id).deletedAt).toBe(now);
    expect(repository.list()).toHaveLength(0);
    expect(repository.restore(created.id).deletedAt).toBeNull();
    database.close();
  });
});
