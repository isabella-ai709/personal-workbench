import { z } from "zod";

const timestampSchema = z.iso.datetime({ offset: true });

export const notificationSeveritySchema = z.enum(["normal", "important", "urgent"]);
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;

export const notificationStatusSchema = z.enum([
  "unread",
  "read",
  "snoozed",
  "resolved",
  "ignored",
]);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const notificationSourceModuleSchema = z.enum([
  "task_plans",
  "business",
  "ai_news",
  "ai_opportunities",
]);
export type NotificationSourceModule = z.infer<typeof notificationSourceModuleSchema>;

export const notificationSourceTypeSchema = z.enum([
  "task_plan",
  "partnership",
  "follow_up",
  "ai_news_report",
  "ai_opportunity_report",
]);
export type NotificationSourceType = z.infer<typeof notificationSourceTypeSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  sourceModule: notificationSourceModuleSchema,
  sourceType: notificationSourceTypeSchema,
  sourceId: z.string().min(1).max(300),
  eventType: z.string().min(1).max(100),
  sourceVersion: z.string().min(1).max(300),
  title: z.string().min(1).max(300),
  body: z.string().max(2_000),
  severity: notificationSeveritySchema,
  status: notificationStatusSchema,
  occurredAt: timestampSchema,
  dueAt: timestampSchema.nullable(),
  snoozedUntil: timestampSchema.nullable(),
  resolvedAt: timestampSchema.nullable(),
  ignoredAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deliveryChannel: z.literal("in_app"),
  metadata: z.record(z.string(), z.string()),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationSummarySchema = z.object({
  importantUnread: z.number().int().nonnegative(),
  totalUnread: z.number().int().nonnegative(),
});
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;

export const notificationListQuerySchema = z.object({
  view: z.enum(["all", "unread", "important", "snoozed", "resolved"]).default("unread"),
  source: notificationSourceModuleSchema.optional(),
  cursor: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type NotificationListQuery = z.output<typeof notificationListQuerySchema>;

export const notificationStatusUpdateSchema = z.object({
  status: z.enum(["read", "unread", "resolved", "ignored"]),
});

export const notificationSnoozeSchema = z.object({
  until: timestampSchema,
});

export const notificationActionSchema = z.object({
  action: z.enum(["advance", "postpone", "cancel"]),
  dueAt: timestampSchema.optional(),
  targetStatus: z
    .enum(["idea", "contacting", "proposal_confirmed", "executing", "completed", "paused"])
    .optional(),
  note: z.string().trim().max(2_000).default(""),
});
export type NotificationAction = z.infer<typeof notificationActionSchema>;

export interface PublishNotificationInput {
  sourceModule: NotificationSourceModule;
  sourceType: NotificationSourceType;
  sourceId: string;
  eventType: string;
  sourceVersion: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  occurredAt: string;
  dueAt?: string | null;
  metadata?: Record<string, string>;
}
