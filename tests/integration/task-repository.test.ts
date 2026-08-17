import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { TaskRepository } from "../../src/server/modules/tasks/task-repository";

const now = "2026-08-17T10:00:00.000Z";

function setup() {
  const database = openDatabase(":memory:");
  migrateDatabase(database);
  return { database, repository: new TaskRepository(database, () => now) };
}

function taskInput(name: string, id: string, nextRunAt: string | null = null) {
  return {
    id,
    name,
    prompt: `Run ${name}`,
    schedule: { cron: "0 * * * *", timezone: "Asia/Shanghai" },
    enabled: true,
    nextRunAt,
  };
}

describe("TaskRepository", () => {
  it("creates, soft deletes, and restores tasks", () => {
    const { database, repository } = setup();
    const id = "10000000-0000-4000-8000-000000000001";
    repository.createTask(taskInput("Daily", id));

    expect(repository.listTasks()).toHaveLength(1);
    expect(repository.softDeleteTask(id).deletedAt).toBe(now);
    expect(repository.listTasks()).toHaveLength(0);
    expect(repository.restoreTask(id).deletedAt).toBeNull();
    database.close();
  });

  it("prevents restoring a deleted task into an active name conflict", () => {
    const { database, repository } = setup();
    const first = "10000000-0000-4000-8000-000000000011";
    const second = "10000000-0000-4000-8000-000000000012";
    repository.createTask(taskInput("Same name", first));
    repository.softDeleteTask(first);
    repository.createTask(taskInput("Same name", second));

    expect(() => repository.restoreTask(first)).toThrow("prevents restoration");
    database.close();
  });

  it("atomically claims the earliest due task and creates one active run", () => {
    const { database, repository } = setup();
    repository.createTask(
      taskInput("Due", "10000000-0000-4000-8000-000000000021", "2026-08-17T09:00:00.000Z"),
    );
    const claim = repository.claimNextDueTask(now, "10000000-0000-4000-8000-000000000022");

    expect(claim?.run.status).toBe("running");
    expect(claim?.run.scheduledFor).toBe("2026-08-17T09:00:00.000Z");
    expect(repository.getTask(claim!.task.id).nextRunAt).toBeNull();
    expect(repository.claimNextDueTask(now)).toBeNull();
    database.close();
  });

  it("rolls back a failed claim without clearing the due time", () => {
    const { database, repository } = setup();
    const existingTask = "10000000-0000-4000-8000-000000000031";
    const dueTask = "10000000-0000-4000-8000-000000000032";
    const duplicateRunId = "10000000-0000-4000-8000-000000000033";
    repository.createTask(taskInput("Existing", existingTask));
    repository.createRun({
      id: duplicateRunId,
      taskId: existingTask,
      status: "missed",
      trigger: "recovery",
      idempotencyKey: "existing-run",
      finishedAt: now,
    });
    repository.createTask(taskInput("Due", dueTask, "2026-08-17T09:00:00.000Z"));

    expect(() => repository.claimNextDueTask(now, duplicateRunId)).toThrow(
      "prevented task claiming",
    );
    expect(repository.getTask(dueTask).nextRunAt).toBe("2026-08-17T09:00:00.000Z");
    database.close();
  });
});
