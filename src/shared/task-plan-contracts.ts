import { z } from "zod";

const identifierSchema = z.string().uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();
const longTextSchema = z.string().trim().max(20_000);

export const taskPlanTypeSchema = z.enum(["todo", "plan", "idea"]);
export type TaskPlanType = z.infer<typeof taskPlanTypeSchema>;

export const taskPlanStatusSchema = z.enum(["pending", "in_progress", "blocked", "completed"]);
export type TaskPlanStatus = z.infer<typeof taskPlanStatusSchema>;

export const taskPlanPrioritySchema = z.enum(["low", "medium", "high"]);
export type TaskPlanPriority = z.infer<typeof taskPlanPrioritySchema>;

export const taskPlanSchema = z.object({
  id: identifierSchema,
  type: taskPlanTypeSchema,
  title: z.string().trim().min(1).max(300),
  status: taskPlanStatusSchema,
  priority: taskPlanPrioritySchema,
  dueAt: nullableTimestampSchema,
  nextAction: z.string().trim().max(2_000),
  notes: longTextSchema,
  completedAt: nullableTimestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
});
export type TaskPlan = z.infer<typeof taskPlanSchema>;

const editableTaskPlanFields = taskPlanSchema.pick({
  type: true,
  title: true,
  status: true,
  priority: true,
  dueAt: true,
  nextAction: true,
  notes: true,
});

export const createTaskPlanInputSchema = editableTaskPlanFields
  .partial()
  .required({ title: true })
  .transform((value) => ({
    type: "todo" as const,
    status: "pending" as const,
    priority: "medium" as const,
    dueAt: null,
    nextAction: "",
    notes: "",
    ...value,
  }));
export type CreateTaskPlanInput = z.input<typeof createTaskPlanInputSchema>;
export type ParsedCreateTaskPlanInput = z.output<typeof createTaskPlanInputSchema>;

export const updateTaskPlanInputSchema = editableTaskPlanFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one task plan field is required");
export type UpdateTaskPlanInput = z.infer<typeof updateTaskPlanInputSchema>;

export const taskPlanListQuerySchema = z.object({
  includeDeleted: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
