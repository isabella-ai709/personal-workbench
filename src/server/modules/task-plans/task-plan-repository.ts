import { randomUUID } from "node:crypto";

import type {
  ParsedCreateTaskPlanInput,
  TaskPlan,
  TaskPlanPriority,
  TaskPlanStatus,
  TaskPlanType,
  UpdateTaskPlanInput,
} from "../../../shared/task-plan-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { WorkbenchDatabase } from "../../db/connection";

interface TaskPlanRow {
  id: string;
  type: TaskPlanType;
  title: string;
  status: TaskPlanStatus;
  priority: TaskPlanPriority;
  due_at: string | null;
  next_action: string;
  notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapTaskPlan(row: TaskPlanRow): TaskPlan {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    nextAction: row.next_action,
    notes: row.notes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class TaskPlanRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  list(includeDeleted = false): TaskPlan[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM task_plans
         ${includeDeleted ? "" : "WHERE deleted_at IS NULL"}
         ORDER BY updated_at DESC, id DESC`,
      )
      .all() as unknown as TaskPlanRow[];
    return rows.map(mapTaskPlan);
  }

  get(id: string, includeDeleted = false): TaskPlan {
    const row = this.database
      .prepare(
        `SELECT * FROM task_plans WHERE id = ? ${includeDeleted ? "" : "AND deleted_at IS NULL"}`,
      )
      .get(id) as TaskPlanRow | undefined;
    if (!row) throw new WorkbenchError("NOT_FOUND", "Task plan not found", 404);
    return mapTaskPlan(row);
  }

  create(input: ParsedCreateTaskPlanInput, id = randomUUID()): TaskPlan {
    const timestamp = this.now();
    const completedAt = input.status === "completed" ? timestamp : null;
    this.database
      .prepare(
        `INSERT INTO task_plans (
           id, type, title, status, priority, due_at, next_action, notes,
           completed_at, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        input.type,
        input.title,
        input.status,
        input.priority,
        input.dueAt,
        input.nextAction,
        input.notes,
        completedAt,
        timestamp,
        timestamp,
      );
    return this.get(id);
  }

  update(id: string, input: UpdateTaskPlanInput): TaskPlan {
    const current = this.get(id);
    const timestamp = this.now();
    const nextStatus = input.status ?? current.status;
    const completedAt =
      nextStatus === "completed"
        ? (current.completedAt ?? timestamp)
        : input.status && current.status === "completed"
          ? null
          : current.completedAt;
    const result = this.database
      .prepare(
        `UPDATE task_plans SET
           type = ?, title = ?, status = ?, priority = ?, due_at = ?,
           next_action = ?, notes = ?, completed_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(
        input.type ?? current.type,
        input.title ?? current.title,
        nextStatus,
        input.priority ?? current.priority,
        input.dueAt === undefined ? current.dueAt : input.dueAt,
        input.nextAction ?? current.nextAction,
        input.notes ?? current.notes,
        completedAt,
        timestamp,
        id,
      );
    if (result.changes === 0) throw new WorkbenchError("NOT_FOUND", "Task plan not found", 404);
    return this.get(id);
  }

  softDelete(id: string): TaskPlan {
    const timestamp = this.now();
    const result = this.database
      .prepare(
        "UPDATE task_plans SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      )
      .run(timestamp, timestamp, id);
    if (result.changes === 0) throw new WorkbenchError("NOT_FOUND", "Task plan not found", 404);
    return this.get(id, true);
  }

  restore(id: string): TaskPlan {
    const result = this.database
      .prepare(
        "UPDATE task_plans SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL",
      )
      .run(this.now(), id);
    if (result.changes === 0)
      throw new WorkbenchError("NOT_FOUND", "Deleted task plan not found", 404);
    return this.get(id);
  }
}
