import { z } from "zod";

import { taskPlanSchema } from "./task-plan-contracts";

export const WORKBENCH_NAME = "个人 Codex 工作台";

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

export const dashboardSummarySchema = z.object({
  plans: z.object({
    pastPlanTime: z.number().int().nonnegative(),
    today: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
  skills: z.object({
    total: z.number().int().nonnegative(),
    enabled: z.number().int().nonnegative(),
    stale: z.boolean(),
  }),
  recentIdeas: z.array(taskPlanSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

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
