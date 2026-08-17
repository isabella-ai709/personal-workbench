import type { TaskRunStatus } from "./contracts";

const transitions: Readonly<Record<TaskRunStatus, ReadonlySet<TaskRunStatus>>> = {
  pending: new Set(["running", "cancelled", "missed"]),
  running: new Set(["succeeded", "failed", "cancelled"]),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  missed: new Set(),
};

export class TaskStateError extends Error {
  readonly code = "INVALID_STATE";

  constructor(message: string) {
    super(message);
    this.name = "TaskStateError";
  }
}

export function canTransitionTaskRun(from: TaskRunStatus, to: TaskRunStatus): boolean {
  return transitions[from].has(to);
}

export function assertTaskRunTransition(from: TaskRunStatus, to: TaskRunStatus): void {
  if (!canTransitionTaskRun(from, to)) {
    throw new TaskStateError(`Task run cannot transition from ${from} to ${to}`);
  }
}

export interface RunTimeline {
  status: TaskRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
}

export function assertRunTimeline(timeline: RunTimeline): void {
  const { status, startedAt, finishedAt } = timeline;
  if (status === "pending" && (startedAt !== null || finishedAt !== null)) {
    throw new TaskStateError("A pending run cannot have start or finish timestamps");
  }
  if (status === "running" && (startedAt === null || finishedAt !== null)) {
    throw new TaskStateError("A running run requires a start timestamp and no finish timestamp");
  }
  if (status === "missed" && (startedAt !== null || finishedAt === null)) {
    throw new TaskStateError("A missed run requires only a finish timestamp");
  }
  if (["succeeded", "failed", "cancelled"].includes(status)) {
    if (startedAt === null || finishedAt === null) {
      throw new TaskStateError(`A ${status} run requires start and finish timestamps`);
    }
    if (Date.parse(finishedAt) < Date.parse(startedAt)) {
      throw new TaskStateError("A run cannot finish before it starts");
    }
  }
}
