import { describe, expect, it } from "vitest";

import type { Task, TaskRun } from "../../src/shared/contracts";
import {
  CronScheduleCalculator,
  TaskScheduler,
  type ScheduledTaskExecutor,
  type SchedulerClock,
  type SchedulerRepository,
} from "../../src/server/modules/tasks/task-scheduler";

const task: Task = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Daily",
  prompt: "Run daily",
  schedule: { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
  enabled: true,
  nextRunAt: "2026-08-17T00:00:00.000Z",
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  deletedAt: null,
};

const run: TaskRun = {
  id: "10000000-0000-4000-8000-000000000002",
  taskId: task.id,
  status: "running",
  trigger: "scheduled",
  scheduledFor: task.nextRunAt,
  startedAt: "2026-08-17T00:00:00.000Z",
  finishedAt: null,
  durationMs: null,
  resultPreview: null,
  errorCode: null,
  errorMessage: null,
  codexThreadId: null,
  hasFullLog: false,
  retriedFromRunId: null,
  createdAt: "2026-08-17T00:00:00.000Z",
};

function fakeClock(): SchedulerClock {
  return {
    now: () => new Date("2026-08-17T00:00:00.000Z"),
    setTimeout: () => 1,
    clearTimeout: () => undefined,
  };
}

describe("CronScheduleCalculator", () => {
  it("calculates the next occurrence in the task's IANA timezone", () => {
    const next = new CronScheduleCalculator().next(
      { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
      new Date("2026-08-17T00:30:00.000Z"),
    );
    expect(next.toISOString()).toBe("2026-08-17T01:00:00.000Z");
  });

  it("rejects invalid cron expressions and timezones", () => {
    expect(() =>
      new CronScheduleCalculator().next({ cron: "not cron", timezone: "Mars/Olympus" }, new Date()),
    ).toThrow("Invalid schedule");
  });
});

describe("TaskScheduler", () => {
  it("records a poll error and schedules the next poll instead of stopping", async () => {
    const callbacks: Array<() => void> = [];
    const clock: SchedulerClock = {
      now: () => new Date("2026-08-17T00:00:00.000Z"),
      setTimeout: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      clearTimeout: () => undefined,
    };
    let attempts = 0;
    const repository = {
      claimNextDueTask: () => {
        attempts += 1;
        throw new Error("temporary database error");
      },
      setNextRunAt: () => undefined,
      completeRun: () => run,
      failInterruptedRuns: () => 0,
      listEnabledTasks: () => [],
      createRun: () => run,
    } satisfies SchedulerRepository;
    const scheduler = new TaskScheduler(
      repository,
      { execute: () => Promise.reject(new Error("not expected")) },
      undefined,
      clock,
    );

    expect(scheduler.start()).toEqual({
      interruptedRuns: 0,
      missedRuns: 0,
      invalidSchedules: 0,
    });
    callbacks.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(attempts).toBe(1);
    expect(scheduler.getLastPollError()?.message).toBe("temporary database error");
    expect(callbacks).toHaveLength(1);
    await scheduler.stop();
  });

  it("does not claim another task while one execution is active", async () => {
    let claims = 0;
    const completed: string[] = [];
    let releaseExecution!: () => void;
    const executor: ScheduledTaskExecutor = {
      execute: () =>
        new Promise((resolve) => {
          releaseExecution = () =>
            resolve({ resultPreview: "ok", codexThreadId: "thread", logPath: null });
        }),
    };
    const repository = {
      claimNextDueTask: () => {
        claims += 1;
        return claims === 1 ? { task, run } : null;
      },
      setNextRunAt: () => undefined,
      completeRun: (runId: string) => {
        completed.push(runId);
        return { ...run, status: "succeeded" as const };
      },
      failInterruptedRuns: () => 0,
      listEnabledTasks: () => [],
      createRun: () => run,
    } satisfies SchedulerRepository;
    const scheduler = new TaskScheduler(repository, executor, undefined, fakeClock());

    const first = scheduler.runOneDueTask();
    await Promise.resolve();
    await expect(scheduler.runOneDueTask()).resolves.toBe(false);
    expect(claims).toBe(1);
    releaseExecution();
    await expect(first).resolves.toBe(true);
    expect(completed).toEqual([run.id]);
  });

  it("waits for the active execution when stopping", async () => {
    let releaseExecution!: () => void;
    const repository = {
      claimNextDueTask: () => ({ task, run }),
      setNextRunAt: () => undefined,
      completeRun: () => ({ ...run, status: "succeeded" as const }),
      failInterruptedRuns: () => 0,
      listEnabledTasks: () => [],
      createRun: () => run,
    } satisfies SchedulerRepository;
    const scheduler = new TaskScheduler(
      repository,
      {
        execute: () =>
          new Promise((resolve) => {
            releaseExecution = () =>
              resolve({ resultPreview: null, codexThreadId: null, logPath: null });
          }),
      },
      undefined,
      fakeClock(),
    );
    const running = scheduler.runOneDueTask();
    await Promise.resolve();

    let stopped = false;
    const stopping = scheduler.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    releaseExecution();
    await running;
    await stopping;
    expect(stopped).toBe(true);
  });
});
