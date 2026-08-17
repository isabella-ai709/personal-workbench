import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { TaskRepository } from "../../src/server/modules/tasks/task-repository";
import { TaskScheduler, type SchedulerClock } from "../../src/server/modules/tasks/task-scheduler";

const now = "2026-08-17T10:00:00.000Z";
const clock: SchedulerClock = {
  now: () => new Date(now),
  setTimeout: () => 1,
  clearTimeout: () => undefined,
};

describe("TaskScheduler recovery", () => {
  it("fails interrupted runs and creates one missed summary per overdue task", () => {
    const database = openDatabase(":memory:");
    migrateDatabase(database);
    const repository = new TaskRepository(database, () => now);
    const interruptedTask = repository.createTask({
      id: "10000000-0000-4000-8000-000000000101",
      name: "Interrupted",
      prompt: "Interrupted run",
      schedule: { cron: "0 * * * *", timezone: "UTC" },
      enabled: true,
      nextRunAt: "2026-08-17T11:00:00.000Z",
    });
    const interruptedRun = repository.createRun({
      id: "10000000-0000-4000-8000-000000000102",
      taskId: interruptedTask.id,
      status: "running",
      trigger: "manual",
      idempotencyKey: "manual-interrupted",
      startedAt: "2026-08-17T09:30:00.000Z",
    });
    const overdueTask = repository.createTask({
      id: "10000000-0000-4000-8000-000000000103",
      name: "Overdue",
      prompt: "Overdue run",
      schedule: { cron: "0 * * * *", timezone: "UTC" },
      enabled: true,
      nextRunAt: "2026-08-15T08:00:00.000Z",
    });
    const scheduler = new TaskScheduler(
      repository,
      { execute: () => Promise.reject(new Error("not expected")) },
      undefined,
      clock,
    );

    expect(scheduler.recover()).toEqual({
      interruptedRuns: 1,
      missedRuns: 1,
      invalidSchedules: 0,
    });
    expect(repository.getRun(interruptedRun.id)).toMatchObject({
      status: "failed",
      errorCode: "SERVICE_INTERRUPTED",
      finishedAt: now,
    });
    expect(repository.listRuns(overdueTask.id)).toHaveLength(1);
    expect(repository.listRuns(overdueTask.id)[0]).toMatchObject({
      status: "missed",
      scheduledFor: "2026-08-15T08:00:00.000Z",
    });
    expect(repository.getTask(overdueTask.id).nextRunAt).toBe("2026-08-17T11:00:00.000Z");
    expect(scheduler.recover()).toEqual({
      interruptedRuns: 0,
      missedRuns: 0,
      invalidSchedules: 0,
    });
    expect(repository.listRuns(overdueTask.id)).toHaveLength(1);
    database.close();
  });
});
