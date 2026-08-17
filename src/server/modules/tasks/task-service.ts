import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  CreateTaskInput,
  PaginationQuery,
  Task,
  TaskRun,
  UpdateTaskInput,
} from "../../../shared/contracts";
import { WorkbenchError } from "../../../shared/errors";
import { CronScheduleCalculator, TaskScheduler } from "./task-scheduler";
import { TaskRepository } from "./task-repository";

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly scheduler: TaskScheduler,
    private readonly schedules = new CronScheduleCalculator(),
    private readonly now: () => Date = () => new Date(),
    private readonly logsDirectory: string = resolve("logs"),
  ) {}

  list(includeDeleted = false): Task[] {
    return this.repository.listTasks(includeDeleted);
  }

  get(id: string): Task {
    return this.repository.getTask(id, true);
  }

  create(input: CreateTaskInput): Task {
    const now = this.now();
    const id = randomUUID();
    const nextRunAt =
      input.enabled === false ? null : this.schedules.next(input.schedule, now, id).toISOString();
    return this.repository.createTask({ ...input, id, nextRunAt });
  }

  update(id: string, input: UpdateTaskInput): Task {
    const current = this.repository.getTask(id);
    const schedule = input.schedule ?? current.schedule;
    const enabled = input.enabled ?? current.enabled;
    const scheduleChanged = input.schedule !== undefined;
    const nextRunAt = !enabled
      ? null
      : scheduleChanged || !current.nextRunAt
        ? this.schedules.next(schedule, this.now(), id).toISOString()
        : current.nextRunAt;
    return this.repository.updateTask(id, { ...input, nextRunAt });
  }

  enable(id: string): Task {
    const task = this.repository.getTask(id);
    const nextRunAt = this.schedules.next(task.schedule, this.now(), id).toISOString();
    return this.repository.updateTask(id, { enabled: true, nextRunAt });
  }

  pause(id: string): Task {
    return this.repository.updateTask(id, { enabled: false, nextRunAt: null });
  }

  runNow(id: string, idempotencyKey: string, retriedFromRunId?: string): TaskRun {
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new WorkbenchError("VALIDATION_ERROR", "Invalid idempotency key", 400);
    }
    if (retriedFromRunId) {
      const original = this.repository.getRun(retriedFromRunId);
      if (original.taskId !== id) {
        throw new WorkbenchError("VALIDATION_ERROR", "Retry source belongs to another task", 400);
      }
      if (!["failed", "cancelled", "missed"].includes(original.status)) {
        throw new WorkbenchError("INVALID_STATE", "Only an unsuccessful run can be retried", 409);
      }
    }
    return this.scheduler.runTaskNow(id, idempotencyKey, retriedFromRunId);
  }

  listRuns(id: string, pagination: PaginationQuery) {
    this.repository.getTask(id, true);
    return this.repository.listRunsPage(id, pagination.limit, pagination.cursor);
  }

  getRun(runId: string): TaskRun {
    return this.repository.getRun(runId);
  }

  async readRunLog(runId: string): Promise<string> {
    const logPath = this.repository.getRunLogPath(runId);
    if (!logPath) throw new WorkbenchError("NOT_FOUND", "This run has no full log", 404);
    const root = resolve(this.logsDirectory);
    const candidate = resolve(logPath);
    const pathFromRoot = relative(root, candidate);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      throw new WorkbenchError(
        "FORBIDDEN",
        "Run log path is outside the workbench log directory",
        403,
      );
    }
    const metadata = await stat(candidate);
    if (metadata.size > 5 * 1024 * 1024) {
      throw new WorkbenchError("FORBIDDEN", "Run log is too large to display", 413);
    }
    return readFile(candidate, "utf8");
  }

  delete(id: string): Task {
    return this.repository.softDeleteTask(id);
  }

  restore(id: string): Task {
    return this.repository.restoreTask(id);
  }
}
