import { z } from "zod";

import { assertRunTimeline } from "./task-state";

export const WORKBENCH_NAME = "个人 Codex 工作台";

export const taskRunStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "missed",
]);
export type TaskRunStatus = z.infer<typeof taskRunStatusSchema>;

export const taskTriggerSchema = z.enum(["scheduled", "manual", "retry", "recovery"]);
export type TaskTrigger = z.infer<typeof taskTriggerSchema>;

const identifierSchema = z.string().uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();

export const taskScheduleSchema = z.object({
  cron: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(120),
});
export type TaskSchedule = z.infer<typeof taskScheduleSchema>;

export const taskSchema = z.object({
  id: identifierSchema,
  name: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(20_000),
  schedule: taskScheduleSchema,
  enabled: z.boolean(),
  nextRunAt: nullableTimestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskInputSchema = taskSchema
  .pick({ name: true, prompt: true, schedule: true })
  .extend({ enabled: z.boolean().default(true) });
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

export const updateTaskInputSchema = taskSchema
  .pick({ name: true, prompt: true, schedule: true, enabled: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one task field is required");
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const taskRunSchema = z
  .object({
    id: identifierSchema,
    taskId: identifierSchema,
    status: taskRunStatusSchema,
    trigger: taskTriggerSchema,
    scheduledFor: nullableTimestampSchema,
    startedAt: nullableTimestampSchema,
    finishedAt: nullableTimestampSchema,
    durationMs: z.number().int().nonnegative().nullable(),
    resultPreview: z.string().max(4_000).nullable(),
    errorCode: z.string().max(120).nullable(),
    errorMessage: z.string().max(2_000).nullable(),
    codexThreadId: z.string().max(200).nullable(),
    hasFullLog: z.boolean(),
    retriedFromRunId: identifierSchema.nullable(),
    createdAt: timestampSchema,
  })
  .superRefine((run, context) => {
    try {
      assertRunTimeline(run);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid task run timeline",
        path: ["status"],
      });
    }
  });
export type TaskRun = z.infer<typeof taskRunSchema>;

export const skillOriginSchema = z.enum([
  "system",
  "plugin",
  "generated",
  "installed",
  "unconfirmed",
]);
export type SkillOrigin = z.infer<typeof skillOriginSchema>;

export const skillScopeSchema = z.enum(["user", "repo", "system", "admin"]);

export const skillSummarySchema = z.object({
  id: z.string().min(16).max(128),
  name: z.string().min(1).max(200),
  description: z.string().max(4_000),
  scope: skillScopeSchema,
  origin: skillOriginSchema,
  enabled: z.boolean(),
  stale: z.boolean(),
  deletable: z.boolean(),
  location: z.string().max(1_000),
});
export type SkillSummary = z.infer<typeof skillSummarySchema>;

export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });
}

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "UNAVAILABLE",
  "FORBIDDEN",
  "INVALID_STATE",
  "TIMEOUT",
  "AUTHENTICATION_FAILED",
  "PROCESS_FAILED",
  "SERVICE_INTERRUPTED",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(1_000),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
