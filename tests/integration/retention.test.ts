import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { cleanupRetention } from "../../src/server/maintenance/retention";

describe("retention cleanup", () => {
  it("removes old runs and deleted tasks while retaining recent and active data", () => {
    const database = openDatabase(":memory:");
    migrateDatabase(database);
    const insertTask = database.prepare(
      `INSERT INTO tasks (id, name, prompt, cron_expression, timezone, enabled, created_at, updated_at, deleted_at)
       VALUES (?, ?, 'prompt', '* * * * *', 'Asia/Shanghai', 0, ?, ?, ?)`,
    );
    insertTask.run(
      "old-deleted",
      "Old deleted",
      "2026-06-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
    );
    insertTask.run(
      "recent-deleted",
      "Recent deleted",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    );
    insertTask.run(
      "active",
      "Active",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      null,
    );
    const insertRun = database.prepare(
      `INSERT INTO task_runs (id, task_id, status, trigger, idempotency_key, created_at)
       VALUES (?, ?, 'succeeded', 'manual', ?, ?)`,
    );
    insertRun.run("old-run", "active", "old-run-key", "2026-05-01T00:00:00.000Z");
    database
      .prepare(
        `INSERT INTO task_runs (id, task_id, status, trigger, idempotency_key, created_at)
         VALUES ('old-running', 'active', 'running', 'manual', 'old-running-key', '2026-05-01T00:00:00.000Z')`,
      )
      .run();
    insertRun.run("recent-run", "active", "recent-run-key", "2026-08-10T00:00:00.000Z");
    insertRun.run("deleted-run", "old-deleted", "deleted-run-key", "2026-06-01T00:00:00.000Z");

    const result = cleanupRetention(database, new Date("2026-08-18T00:00:00.000Z"));
    expect(result.deletedRuns).toBe(2);
    expect(result.deletedTasks).toBe(1);
    expect(database.prepare("SELECT id FROM task_runs").all()).toHaveLength(2);
    expect(database.prepare("SELECT id FROM tasks").all()).toHaveLength(2);
    database.close();
  });
});
