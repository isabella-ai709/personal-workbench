import { z } from "zod";

const longText = z.string().trim().max(20_000);

export const retrospectiveSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  review: longText,
  didWell: longText,
  didWrong: longText,
  lesson: longText,
  nextImprovement: longText,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Retrospective = z.infer<typeof retrospectiveSchema>;

const editableFields = retrospectiveSchema.pick({
  title: true,
  review: true,
  didWell: true,
  didWrong: true,
  lesson: true,
  nextImprovement: true,
});

export const createRetrospectiveInputSchema = editableFields
  .partial()
  .required({ title: true })
  .transform((value) => ({
    review: "",
    didWell: "",
    didWrong: "",
    lesson: "",
    nextImprovement: "",
    ...value,
  }));
export type CreateRetrospectiveInput = z.input<typeof createRetrospectiveInputSchema>;

export const updateRetrospectiveInputSchema = editableFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export type UpdateRetrospectiveInput = z.infer<typeof updateRetrospectiveInputSchema>;

export const retrospectiveAiAnalysisSchema = z.object({
  retrospectiveId: z.string().uuid(),
  summary: z.string().trim().max(20_000),
  strengths: z.array(z.string().trim().max(2_000)).max(50),
  issues: z.array(z.string().trim().max(2_000)).max(50),
  suggestions: z.array(z.string().trim().max(2_000)).max(50),
  nextActions: z.array(z.string().trim().max(2_000)).max(50),
});
export type RetrospectiveAiAnalysis = z.infer<typeof retrospectiveAiAnalysisSchema>;
