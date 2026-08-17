import { CronExpressionParser } from "cron-parser";

import type { Task, TaskRun, TaskSchedule } from "../../../shared/contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { ClaimedTask, CompleteRunInput, CreateRunInput } from "./task-repository";

export interface SchedulerRepository {
  claimNextDueTask(now: string): ClaimedTask | null;
  setNextRunAt(taskId: string, nextRunAt: string | null): void;
  completeRun(runId: string, input: CompleteRunInput): TaskRun;
  failInterruptedRuns(finishedAt: string): number;
  listEnabledTasks(): Task[];
  createRun(input: CreateRunInput): TaskRun;
}

export interface TaskExecutionResult {
  resultPreview: string | null;
  codexThreadId: string | null;
  logPath: string | null;
}

export interface ScheduledTaskExecutor {
  execute(task: Task, run: TaskRun, signal?: AbortSignal): Promise<TaskExecutionResult>;
}

export type TaskExecutionErrorCode =
  "TIMEOUT" | "CANCELLED" | "AUTHENTICATION_FAILED" | "PROCESS_FAILED";

export class TaskExecutionError extends Error {
  constructor(
    readonly code: TaskExecutionErrorCode,
    message: string,
    readonly runStatus: "failed" | "cancelled" = "failed",
    readonly logPath: string | null = null,
  ) {
    super(message);
    this.name = "TaskExecutionError";
  }
}

export interface SchedulerClock {
  now(): Date;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemSchedulerClock: SchedulerClock = {
  now: () => new Date(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class CronScheduleCalculator {
  next(schedule: TaskSchedule, after: Date, hashSeed?: string): Date {
    try {
      return CronExpressionParser.parse(schedule.cron, {
        currentDate: after,
        tz: schedule.timezone,
        hashSeed,
      })
        .next()
        .toDate();
    } catch (error) {
      throw new WorkbenchError(
        "VALIDATION_ERROR",
        `Invalid schedule: ${error instanceof Error ? error.message : String(error)}`,
        400,
      );
    }
  }
}

export interface RecoveryReport {
  interruptedRuns: number;
  missedRuns: number;
  invalidSchedules: number;
}

export class TaskScheduler {
  private active = false;
  private timer: unknown;
  private currentExecution: Promise<void> | null = null;
  private lastPollError: Error | null = null;

  constructor(
    private readonly repository: SchedulerRepository,
    private readonly executor: ScheduledTaskExecutor,
    private readonly schedules = new CronScheduleCalculator(),
    private readonly clock: SchedulerClock = systemSchedulerClock,
    private readonly pollIntervalMs = 1_000,
  ) {}

  start(): RecoveryReport {
    if (this.active) throw new WorkbenchError("CONFLICT", "Task scheduler is already running", 409);
    const report = this.recover();
    this.active = true;
    this.schedulePoll(0);
    return report;
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
    await this.currentExecution;
  }

  recover(): RecoveryReport {
    const now = this.clock.now();
    const nowIso = now.toISOString();
    const interruptedRuns = this.repository.failInterruptedRuns(nowIso);
    let missedRuns = 0;
    let invalidSchedules = 0;

    for (const task of this.repository.listEnabledTasks()) {
      if (!task.nextRunAt || Date.parse(task.nextRunAt) > now.getTime()) continue;
      try {
        this.repository.createRun({
          taskId: task.id,
          status: "missed",
          trigger: "recovery",
          idempotencyKey: `recovery-missed:${task.id}:${task.nextRunAt}`,
          scheduledFor: task.nextRunAt,
          finishedAt: nowIso,
        });
        missedRuns += 1;
      } catch (error) {
        if (!(error instanceof WorkbenchError && error.code === "CONFLICT")) throw error;
      }
      try {
        const nextRunAt = this.schedules.next(task.schedule, now, task.id).toISOString();
        this.repository.setNextRunAt(task.id, nextRunAt);
      } catch (error) {
        this.repository.setNextRunAt(task.id, null);
        this.lastPollError = error instanceof Error ? error : new Error(String(error));
        invalidSchedules += 1;
      }
    }
    return { interruptedRuns, missedRuns, invalidSchedules };
  }

  async runOneDueTask(): Promise<boolean> {
    if (this.currentExecution) return false;
    const now = this.clock.now();
    const claim = this.repository.claimNextDueTask(now.toISOString());
    if (!claim) return false;

    try {
      this.repository.setNextRunAt(
        claim.task.id,
        this.schedules.next(claim.task.schedule, now, claim.task.id).toISOString(),
      );
    } catch (error) {
      this.repository.completeRun(claim.run.id, {
        status: "failed",
        finishedAt: now.toISOString(),
        errorCode: error instanceof WorkbenchError ? error.code : "INVALID_STATE",
        errorMessage: error instanceof Error ? error.message : "Invalid task schedule",
      });
      this.lastPollError = error instanceof Error ? error : new Error(String(error));
      return true;
    }
    const execution = this.executeClaim(claim);
    this.currentExecution = execution;
    try {
      await execution;
    } finally {
      if (this.currentExecution === execution) this.currentExecution = null;
    }
    return true;
  }

  private async executeClaim(claim: ClaimedTask): Promise<void> {
    try {
      const result = await this.executor.execute(claim.task, claim.run);
      this.repository.completeRun(claim.run.id, {
        status: "succeeded",
        finishedAt: this.clock.now().toISOString(),
        resultPreview: result.resultPreview,
        logPath: result.logPath,
        codexThreadId: result.codexThreadId,
      });
    } catch (error) {
      this.repository.completeRun(claim.run.id, {
        status: error instanceof TaskExecutionError ? error.runStatus : "failed",
        finishedAt: this.clock.now().toISOString(),
        errorCode: error instanceof TaskExecutionError ? error.code : "PROCESS_FAILED",
        errorMessage: error instanceof Error ? error.message : "Task execution failed",
        logPath: error instanceof TaskExecutionError ? error.logPath : null,
      });
    }
  }

  private schedulePoll(delayMs: number): void {
    this.timer = this.clock.setTimeout(() => {
      void this.poll();
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.active) return;
    try {
      await this.runOneDueTask();
    } catch (error) {
      this.lastPollError = error instanceof Error ? error : new Error(String(error));
    } finally {
      if (this.active) this.schedulePoll(this.pollIntervalMs);
    }
  }

  getLastPollError(): Error | null {
    return this.lastPollError;
  }
}
