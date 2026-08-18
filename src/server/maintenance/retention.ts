import type { WorkbenchDatabase } from "../db/connection";

export const RUN_RETENTION_DAYS = 90;
export const DELETED_TASK_RETENTION_DAYS = 30;

export interface RetentionResult {
  deletedRuns: number;
  deletedTasks: number;
  runCutoff: string;
  deletedTaskCutoff: string;
}

function cutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Remove only data covered by the documented retention policy. */
export function cleanupRetention(
  database: WorkbenchDatabase,
  now = new Date(),
  runRetentionDays = RUN_RETENTION_DAYS,
  deletedTaskRetentionDays = DELETED_TASK_RETENTION_DAYS,
): RetentionResult {
  const runCutoff = cutoff(now, runRetentionDays);
  const deletedTaskCutoff = cutoff(now, deletedTaskRetentionDays);
  database.exec("BEGIN IMMEDIATE");
  try {
    const deletedTaskRuns = database
      .prepare(
        `DELETE FROM task_runs
           WHERE task_id IN (
             SELECT id FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?
           )`,
      )
      .run(deletedTaskCutoff).changes;
    const oldRuns = database
      .prepare(
        "DELETE FROM task_runs WHERE created_at < ? AND status NOT IN ('pending', 'running')",
      )
      .run(runCutoff).changes;
    const oldTasks = database
      .prepare("DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?")
      .run(deletedTaskCutoff).changes;
    database.exec("COMMIT");
    return {
      deletedRuns: Number(oldRuns) + Number(deletedTaskRuns),
      deletedTasks: Number(oldTasks),
      runCutoff,
      deletedTaskCutoff,
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
