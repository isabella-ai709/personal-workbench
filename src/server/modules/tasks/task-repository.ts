import { randomUUID } from "node:crypto";

import type {
  CreateTaskInput,
  Task,
  TaskRun,
  TaskRunStatus,
  TaskTrigger,
  UpdateTaskInput,
} from "../../../shared/contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { WorkbenchDatabase } from "../../db/connection";

interface TaskRow {
  id: string;
  name: string;
  prompt: string;
  cron_expression: string;
  timezone: string;
  enabled: number;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TaskRunRow {
  id: string;
  task_id: string;
  status: TaskRunStatus;
  trigger: TaskTrigger;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  result_preview: string | null;
  log_path: string | null;
  error_code: string | null;
  error_message: string | null;
  codex_thread_id: string | null;
  retried_from_run_id: string | null;
  created_at: string;
}

export interface CreateTaskRecordInput extends CreateTaskInput {
  id?: string;
  nextRunAt?: string | null;
}

export interface CreateRunInput {
  id?: string;
  taskId: string;
  status: TaskRunStatus;
  trigger: TaskTrigger;
  idempotencyKey: string;
  scheduledFor?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  retriedFromRunId?: string | null;
}

export interface ClaimedTask {
  task: Task;
  run: TaskRun;
}

export interface ManualTaskClaim extends ClaimedTask {
  created: boolean;
}

export interface UpdateTaskRecordInput extends UpdateTaskInput {
  nextRunAt?: string | null;
}

export interface CompleteRunInput {
  status: Extract<TaskRunStatus, "succeeded" | "failed" | "cancelled">;
  finishedAt: string;
  resultPreview?: string | null;
  logPath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  codexThreadId?: string | null;
}

export interface TaskStatistics {
  total: number;
  enabled: number;
  paused: number;
  failedRuns: number;
}

export interface RecentTaskRun extends TaskRun {
  taskName: string;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    schedule: { cron: row.cron_expression, timezone: row.timezone },
    enabled: row.enabled === 1,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapRun(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    trigger: row.trigger,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    resultPreview: row.result_preview,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    codexThreadId: row.codex_thread_id,
    hasFullLog: row.log_path !== null,
    retriedFromRunId: row.retried_from_run_id,
    createdAt: row.created_at,
  };
}

function databaseConflict(error: unknown, message: string): never {
  if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
    throw new WorkbenchError("CONFLICT", message, 409);
  }
  throw error;
}

export class TaskRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  createTask(input: CreateTaskRecordInput): Task {
    const timestamp = this.now();
    const id = input.id ?? randomUUID();
    try {
      this.database
        .prepare(
          `INSERT INTO tasks (
             id, name, prompt, cron_expression, timezone, enabled, next_run_at,
             created_at, updated_at, deleted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          id,
          input.name,
          input.prompt,
          input.schedule.cron,
          input.schedule.timezone,
          input.enabled === false ? 0 : 1,
          input.nextRunAt ?? null,
          timestamp,
          timestamp,
        );
    } catch (error) {
      databaseConflict(error, "An active task with this name already exists");
    }
    return this.getTask(id, true);
  }

  getTask(id: string, includeDeleted = false): Task {
    const row = this.database
      .prepare(`SELECT * FROM tasks WHERE id = ? ${includeDeleted ? "" : "AND deleted_at IS NULL"}`)
      .get(id) as TaskRow | undefined;
    if (!row) throw new WorkbenchError("NOT_FOUND", "Task not found", 404);
    return mapTask(row);
  }

  listTasks(includeDeleted = false): Task[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM tasks ${includeDeleted ? "" : "WHERE deleted_at IS NULL"} ORDER BY created_at DESC`,
        )
        .all() as unknown as TaskRow[]
    ).map(mapTask);
  }

  listEnabledTasks(): Task[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM tasks WHERE enabled = 1 AND deleted_at IS NULL ORDER BY created_at ASC",
        )
        .all() as unknown as TaskRow[]
    ).map(mapTask);
  }

  getStatistics(): TaskStatistics {
    const taskCounts = this.database
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END), 0) AS enabled
           FROM tasks WHERE deleted_at IS NULL`,
      )
      .get() as { total: number; enabled: number };
    const failures = this.database
      .prepare("SELECT COUNT(*) AS count FROM task_runs WHERE status = 'failed'")
      .get() as { count: number };
    return {
      total: taskCounts.total,
      enabled: taskCounts.enabled,
      paused: taskCounts.total - taskCounts.enabled,
      failedRuns: failures.count,
    };
  }

  listRecentRuns(limit = 5): RecentTaskRun[] {
    const rows = this.database
      .prepare(
        `SELECT task_runs.*, tasks.name AS task_name
           FROM task_runs
           JOIN tasks ON tasks.id = task_runs.task_id
          ORDER BY task_runs.created_at DESC, task_runs.id DESC
          LIMIT ?`,
      )
      .all(limit) as unknown as Array<TaskRunRow & { task_name: string }>;
    return rows.map((row) => ({ ...mapRun(row), taskName: row.task_name }));
  }

  setNextRunAt(id: string, nextRunAt: string | null): void {
    const result = this.database
      .prepare("UPDATE tasks SET next_run_at = ?, updated_at = ? WHERE id = ?")
      .run(nextRunAt, this.now(), id);
    if (result.changes === 0) throw new WorkbenchError("NOT_FOUND", "Task not found", 404);
  }

  updateTask(id: string, input: UpdateTaskRecordInput): Task {
    const current = this.getTask(id);
    const schedule = input.schedule ?? current.schedule;
    try {
      this.database
        .prepare(
          `UPDATE tasks SET
             name = ?, prompt = ?, cron_expression = ?, timezone = ?, enabled = ?,
             next_run_at = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .run(
          input.name ?? current.name,
          input.prompt ?? current.prompt,
          schedule.cron,
          schedule.timezone,
          (input.enabled ?? current.enabled) ? 1 : 0,
          input.nextRunAt === undefined ? current.nextRunAt : input.nextRunAt,
          this.now(),
          id,
        );
    } catch (error) {
      databaseConflict(error, "An active task with this name already exists");
    }
    return this.getTask(id);
  }

  softDeleteTask(id: string): Task {
    const timestamp = this.now();
    const result = this.database
      .prepare(
        "UPDATE tasks SET deleted_at = ?, enabled = 0, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      )
      .run(timestamp, timestamp, id);
    if (result.changes === 0) throw new WorkbenchError("NOT_FOUND", "Active task not found", 404);
    return this.getTask(id, true);
  }

  restoreTask(id: string): Task {
    try {
      const result = this.database
        .prepare(
          "UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL",
        )
        .run(this.now(), id);
      if (result.changes === 0)
        throw new WorkbenchError("NOT_FOUND", "Deleted task not found", 404);
    } catch (error) {
      databaseConflict(error, "An active task with this name prevents restoration");
    }
    return this.getTask(id);
  }

  createRun(input: CreateRunInput): TaskRun {
    const id = input.id ?? randomUUID();
    try {
      this.database
        .prepare(
          `INSERT INTO task_runs (
             id, task_id, status, trigger, scheduled_for, started_at, finished_at,
             duration_ms, result_preview, log_path, error_code, error_message,
             codex_thread_id, idempotency_key, retried_from_run_id, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
        )
        .run(
          id,
          input.taskId,
          input.status,
          input.trigger,
          input.scheduledFor ?? null,
          input.startedAt ?? null,
          input.finishedAt ?? null,
          input.idempotencyKey,
          input.retriedFromRunId ?? null,
          this.now(),
        );
    } catch (error) {
      databaseConflict(error, "A conflicting or duplicate task run already exists");
    }
    return this.getRun(id);
  }

  getRun(id: string): TaskRun {
    const row = this.database.prepare("SELECT * FROM task_runs WHERE id = ?").get(id) as
      TaskRunRow | undefined;
    if (!row) throw new WorkbenchError("NOT_FOUND", "Task run not found", 404);
    return mapRun(row);
  }

  getRunLogPath(id: string): string | null {
    const row = this.database.prepare("SELECT log_path FROM task_runs WHERE id = ?").get(id) as
      { log_path: string | null } | undefined;
    if (!row) throw new WorkbenchError("NOT_FOUND", "Task run not found", 404);
    return row.log_path;
  }

  findRunByIdempotencyKey(idempotencyKey: string): TaskRun | null {
    const row = this.database
      .prepare("SELECT * FROM task_runs WHERE idempotency_key = ?")
      .get(idempotencyKey) as TaskRunRow | undefined;
    return row ? mapRun(row) : null;
  }

  listRuns(taskId: string): TaskRun[] {
    return (
      this.database
        .prepare("SELECT * FROM task_runs WHERE task_id = ? ORDER BY created_at DESC")
        .all(taskId) as unknown as TaskRunRow[]
    ).map(mapRun);
  }

  listRunsPage(
    taskId: string,
    limit: number,
    cursor?: string,
  ): { items: TaskRun[]; nextCursor: string | null } {
    const [cursorTime, cursorId] = cursor ? cursor.split("|") : [undefined, undefined];
    if (cursor && (!cursorTime || !cursorId)) {
      throw new WorkbenchError("VALIDATION_ERROR", "Invalid run history cursor", 400);
    }
    const rows = this.database
      .prepare(
        `SELECT * FROM task_runs
         WHERE task_id = ? AND (
           ? IS NULL OR created_at < ? OR (created_at = ? AND id < ?)
         )
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(
        taskId,
        cursorTime ?? null,
        cursorTime ?? null,
        cursorTime ?? null,
        cursorId ?? null,
        limit + 1,
      ) as unknown as TaskRunRow[];
    const items = rows.slice(0, limit).map(mapRun);
    const lastItem = rows.slice(0, limit).at(-1);
    return {
      items,
      nextCursor: rows.length > limit && lastItem ? `${lastItem.created_at}|${lastItem.id}` : null,
    };
  }

  claimManualTask(
    taskId: string,
    idempotencyKey: string,
    runId = randomUUID(),
    retriedFromRunId?: string | null,
  ): ManualTaskClaim {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.findRunByIdempotencyKey(idempotencyKey);
      if (existing) {
        const task = this.getTask(existing.taskId, true);
        this.database.exec("COMMIT");
        return { task, run: existing, created: false };
      }
      const task = this.getTask(taskId);
      const now = this.now();
      this.database
        .prepare(
          `INSERT INTO task_runs (
             id, task_id, status, trigger, scheduled_for, started_at, finished_at,
             duration_ms, result_preview, log_path, error_code, error_message,
             codex_thread_id, idempotency_key, retried_from_run_id, created_at
           ) VALUES (?, ?, 'running', ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
        )
        .run(
          runId,
          taskId,
          retriedFromRunId ? "retry" : "manual",
          now,
          idempotencyKey,
          retriedFromRunId ?? null,
          now,
        );
      this.database.exec("COMMIT");
      return { task, run: this.getRun(runId), created: true };
    } catch (error) {
      this.database.exec("ROLLBACK");
      databaseConflict(error, "This task already has an active run");
    }
  }

  completeRun(id: string, input: CompleteRunInput): TaskRun {
    const current = this.getRun(id);
    if (current.status !== "running" || current.startedAt === null) {
      throw new WorkbenchError("INVALID_STATE", "Only a running task run can be completed", 409);
    }
    const durationMs = Math.max(0, Date.parse(input.finishedAt) - Date.parse(current.startedAt));
    const result = this.database
      .prepare(
        `UPDATE task_runs SET
           status = ?, finished_at = ?, duration_ms = ?, result_preview = ?, log_path = ?,
           error_code = ?, error_message = ?, codex_thread_id = ?
         WHERE id = ? AND status = 'running'`,
      )
      .run(
        input.status,
        input.finishedAt,
        durationMs,
        input.resultPreview ?? null,
        input.logPath ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.codexThreadId ?? null,
        id,
      );
    if (result.changes === 0) {
      throw new WorkbenchError("CONFLICT", "Task run changed before completion", 409);
    }
    return this.getRun(id);
  }

  failInterruptedRuns(finishedAt: string): number {
    return Number(
      this.database
        .prepare(
          `UPDATE task_runs SET
             status = 'failed',
             finished_at = ?,
             duration_ms = CASE
               WHEN started_at IS NULL THEN NULL
               ELSE MAX(0, CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER))
             END,
             error_code = 'SERVICE_INTERRUPTED',
             error_message = 'The workbench stopped before this run completed.'
           WHERE status = 'running'`,
        )
        .run(finishedAt, finishedAt).changes,
    );
  }

  claimNextDueTask(now: string, runId = randomUUID()): ClaimedTask | null {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.database
        .prepare(
          `SELECT * FROM tasks t
           WHERE t.enabled = 1
             AND t.deleted_at IS NULL
             AND t.next_run_at IS NOT NULL
             AND t.next_run_at <= ?
             AND NOT EXISTS (
               SELECT 1 FROM task_runs r
               WHERE r.task_id = t.id AND r.status IN ('pending', 'running')
             )
           ORDER BY t.next_run_at ASC, t.created_at ASC
           LIMIT 1`,
        )
        .get(now) as TaskRow | undefined;
      if (!row) {
        this.database.exec("COMMIT");
        return null;
      }

      const idempotencyKey = `scheduled:${row.id}:${row.next_run_at}`;
      this.database
        .prepare(
          `INSERT INTO task_runs (
             id, task_id, status, trigger, scheduled_for, started_at, finished_at,
             duration_ms, result_preview, log_path, error_code, error_message,
             codex_thread_id, idempotency_key, retried_from_run_id, created_at
           ) VALUES (?, ?, 'running', 'scheduled', ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, ?)`,
        )
        .run(runId, row.id, row.next_run_at, now, idempotencyKey, now);
      this.database
        .prepare("UPDATE tasks SET next_run_at = NULL, updated_at = ? WHERE id = ?")
        .run(now, row.id);
      this.database.exec("COMMIT");
      return { task: this.getTask(row.id), run: this.getRun(runId) };
    } catch (error) {
      this.database.exec("ROLLBACK");
      databaseConflict(error, "A conflicting task run prevented task claiming");
    }
  }
}
