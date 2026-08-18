import { z } from "zod";

const idSchema = z.string().uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const nullableTimestampSchema = timestampSchema.nullable();
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(20_000);

export const companyRelationshipStatusSchema = z.enum([
  "lead",
  "contacted",
  "active",
  "former",
  "paused",
]);
export type CompanyRelationshipStatus = z.infer<typeof companyRelationshipStatusSchema>;

export const contactDecisionRoleSchema = z.enum([
  "decision_maker",
  "influencer",
  "user",
  "executor",
  "unknown",
]);
export type ContactDecisionRole = z.infer<typeof contactDecisionRoleSchema>;

export const opportunityStageSchema = z.enum([
  "lead",
  "contacted",
  "needs_confirmed",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);
export type OpportunityStage = z.infer<typeof opportunityStageSchema>;

export const partnershipStatusSchema = z.enum([
  "idea",
  "contacting",
  "proposal_confirmed",
  "executing",
  "completed",
  "terminated",
  "paused",
]);
export type PartnershipStatus = z.infer<typeof partnershipStatusSchema>;

export const activityTypeSchema = z.enum(["call", "visit", "meeting", "wechat", "email", "note"]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const followUpStatusSchema = z.enum(["pending", "completed", "cancelled"]);
export const followUpPrioritySchema = z.enum(["low", "medium", "high"]);

export const companySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  shortName: shortText,
  industry: shortText,
  region: shortText,
  website: z.string().trim().max(500),
  source: shortText,
  tags: z.array(shortText).max(30),
  relationshipStatus: companyRelationshipStatusSchema,
  owner: shortText,
  notes: longText,
  lastContactAt: nullableTimestampSchema,
  nextFollowUpAt: nullableTimestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
});
export type Company = z.infer<typeof companySchema>;

export const createCompanyInputSchema = companySchema
  .pick({
    name: true,
    shortName: true,
    industry: true,
    region: true,
    website: true,
    source: true,
    tags: true,
    relationshipStatus: true,
    owner: true,
    notes: true,
    nextFollowUpAt: true,
  })
  .partial()
  .required({ name: true })
  .transform((value) => ({
    shortName: "",
    industry: "",
    region: "",
    website: "",
    source: "",
    tags: [],
    relationshipStatus: "lead" as const,
    owner: "",
    notes: "",
    nextFollowUpAt: null,
    ...value,
  }));
export type CreateCompanyInput = z.input<typeof createCompanyInputSchema>;
export const updateCompanyInputSchema = companySchema
  .pick({
    name: true,
    shortName: true,
    industry: true,
    region: true,
    website: true,
    source: true,
    tags: true,
    relationshipStatus: true,
    owner: true,
    notes: true,
    nextFollowUpAt: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one company field is required");
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;

export const contactSchema = z.object({
  id: idSchema,
  companyId: idSchema.nullable(),
  name: z.string().trim().min(1).max(200),
  title: shortText,
  department: shortText,
  phone: shortText,
  wechat: shortText,
  email: z.string().trim().max(320),
  decisionRole: contactDecisionRoleSchema,
  relationshipLevel: z.number().int().min(1).max(5),
  preferences: longText,
  tags: z.array(shortText).max(30),
  notes: longText,
  lastContactAt: nullableTimestampSchema,
  nextFollowUpAt: nullableTimestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
});
export type Contact = z.infer<typeof contactSchema>;
export const createContactInputSchema = contactSchema
  .pick({
    companyId: true,
    name: true,
    title: true,
    department: true,
    phone: true,
    wechat: true,
    email: true,
    decisionRole: true,
    relationshipLevel: true,
    preferences: true,
    tags: true,
    notes: true,
    nextFollowUpAt: true,
  })
  .partial()
  .required({ name: true })
  .transform((value) => ({
    companyId: null,
    title: "",
    department: "",
    phone: "",
    wechat: "",
    email: "",
    decisionRole: "unknown" as const,
    relationshipLevel: 1,
    preferences: "",
    tags: [],
    notes: "",
    nextFollowUpAt: null,
    ...value,
  }));
export type CreateContactInput = z.input<typeof createContactInputSchema>;
export const updateContactInputSchema = contactSchema
  .pick({
    companyId: true,
    name: true,
    title: true,
    department: true,
    phone: true,
    wechat: true,
    email: true,
    decisionRole: true,
    relationshipLevel: true,
    preferences: true,
    tags: true,
    notes: true,
    nextFollowUpAt: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one contact field is required");
export type UpdateContactInput = z.infer<typeof updateContactInputSchema>;

export const opportunitySchema = z.object({
  id: idSchema,
  companyId: idSchema.nullable(),
  primaryContactId: idSchema.nullable(),
  name: z.string().trim().min(1).max(200),
  stage: opportunityStageSchema,
  needs: longText,
  offering: shortText,
  amountMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().trim().min(3).max(3),
  probability: z.number().int().min(0).max(100),
  expectedCloseAt: nullableTimestampSchema,
  source: shortText,
  competition: longText,
  risks: longText,
  owner: shortText,
  resultSummary: longText,
  lossReason: longText,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
});
export type Opportunity = z.infer<typeof opportunitySchema>;
export const createOpportunityInputSchema = opportunitySchema
  .pick({
    companyId: true,
    primaryContactId: true,
    name: true,
    stage: true,
    needs: true,
    offering: true,
    amountMinor: true,
    currency: true,
    probability: true,
    expectedCloseAt: true,
    source: true,
    competition: true,
    risks: true,
    owner: true,
  })
  .partial()
  .required({ name: true })
  .transform((value) => ({
    companyId: null,
    primaryContactId: null,
    stage: "lead" as const,
    needs: "",
    offering: "",
    amountMinor: null,
    currency: "CNY",
    probability: 10,
    expectedCloseAt: null,
    source: "",
    competition: "",
    risks: "",
    owner: "",
    ...value,
  }));
export type CreateOpportunityInput = z.input<typeof createOpportunityInputSchema>;
export const updateOpportunityInputSchema = opportunitySchema
  .pick({
    companyId: true,
    primaryContactId: true,
    name: true,
    needs: true,
    offering: true,
    amountMinor: true,
    currency: true,
    probability: true,
    expectedCloseAt: true,
    source: true,
    competition: true,
    risks: true,
    owner: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one opportunity field is required");
export type UpdateOpportunityInput = z.infer<typeof updateOpportunityInputSchema>;

export const partnershipSchema = z.object({
  id: idSchema,
  companyId: idSchema.nullable(),
  primaryContactId: idSchema.nullable(),
  linkedOpportunityId: idSchema.nullable(),
  name: z.string().trim().min(1).max(200),
  type: shortText,
  status: partnershipStatusSchema,
  objective: longText,
  proposalSummary: longText,
  contributions: longText,
  expectedOutcome: longText,
  risks: longText,
  owner: shortText,
  startAt: nullableTimestampSchema,
  targetEndAt: nullableTimestampSchema,
  resultSummary: longText,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTimestampSchema,
});
export type Partnership = z.infer<typeof partnershipSchema>;
export const createPartnershipInputSchema = partnershipSchema
  .pick({
    companyId: true,
    primaryContactId: true,
    linkedOpportunityId: true,
    name: true,
    type: true,
    status: true,
    objective: true,
    proposalSummary: true,
    contributions: true,
    expectedOutcome: true,
    risks: true,
    owner: true,
    startAt: true,
    targetEndAt: true,
  })
  .partial()
  .required({ name: true })
  .transform((value) => ({
    companyId: null,
    primaryContactId: null,
    linkedOpportunityId: null,
    type: "",
    status: "idea" as const,
    objective: "",
    proposalSummary: "",
    contributions: "",
    expectedOutcome: "",
    risks: "",
    owner: "",
    startAt: null,
    targetEndAt: null,
    ...value,
  }));
export type CreatePartnershipInput = z.input<typeof createPartnershipInputSchema>;
export const updatePartnershipInputSchema = partnershipSchema
  .pick({
    companyId: true,
    primaryContactId: true,
    linkedOpportunityId: true,
    name: true,
    type: true,
    objective: true,
    proposalSummary: true,
    contributions: true,
    expectedOutcome: true,
    risks: true,
    owner: true,
    startAt: true,
    targetEndAt: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one partnership field is required");
export type UpdatePartnershipInput = z.infer<typeof updatePartnershipInputSchema>;

export const activitySchema = z.object({
  id: idSchema,
  type: activityTypeSchema,
  occurredAt: timestampSchema,
  participants: shortText,
  rawContent: longText,
  summary: z.string().trim().min(1).max(20_000),
  sourceType: z.enum(["manual", "ai_confirmed", "external"]),
  companyId: idSchema.nullable(),
  contactId: idSchema.nullable(),
  opportunityId: idSchema.nullable(),
  partnershipId: idSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type BusinessActivity = z.infer<typeof activitySchema>;
export const createActivityInputSchema = activitySchema
  .pick({
    type: true,
    occurredAt: true,
    participants: true,
    rawContent: true,
    summary: true,
    companyId: true,
    contactId: true,
    opportunityId: true,
    partnershipId: true,
  })
  .partial()
  .required({ summary: true })
  .transform((value) => ({
    type: "note" as const,
    occurredAt: new Date().toISOString(),
    participants: "",
    rawContent: "",
    companyId: null,
    contactId: null,
    opportunityId: null,
    partnershipId: null,
    ...value,
  }))
  .refine(
    (value) =>
      Boolean(value.companyId || value.contactId || value.opportunityId || value.partnershipId),
    "An activity must be linked to at least one business object",
  );
export type CreateActivityInput = z.input<typeof createActivityInputSchema>;

export const followUpSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(300),
  description: longText,
  dueAt: timestampSchema,
  priority: followUpPrioritySchema,
  status: followUpStatusSchema,
  owner: shortText,
  sourceActivityId: idSchema.nullable(),
  companyId: idSchema.nullable(),
  contactId: idSchema.nullable(),
  opportunityId: idSchema.nullable(),
  partnershipId: idSchema.nullable(),
  completedAt: nullableTimestampSchema,
  completionNote: longText,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type FollowUp = z.infer<typeof followUpSchema>;
export const createFollowUpInputSchema = followUpSchema
  .pick({
    title: true,
    description: true,
    dueAt: true,
    priority: true,
    owner: true,
    sourceActivityId: true,
    companyId: true,
    contactId: true,
    opportunityId: true,
    partnershipId: true,
  })
  .partial()
  .required({ title: true, dueAt: true })
  .transform((value) => ({
    description: "",
    priority: "medium" as const,
    owner: "",
    sourceActivityId: null,
    companyId: null,
    contactId: null,
    opportunityId: null,
    partnershipId: null,
    ...value,
  }));
export type CreateFollowUpInput = z.input<typeof createFollowUpInputSchema>;

export const businessDashboardSchema = z.object({
  followUps: z.object({
    dueToday: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
    nextSevenDays: z.number().int().nonnegative(),
  }),
  opportunities: z.object({
    active: z.number().int().nonnegative(),
    amountMinor: z.number().int().nonnegative(),
    byStage: z.record(opportunityStageSchema, z.number().int().nonnegative()),
  }),
  activePartnerships: z.number().int().nonnegative(),
  companies: z.number().int().nonnegative(),
  contacts: z.number().int().nonnegative(),
  recentActivities: z.array(activitySchema),
});
export type BusinessDashboard = z.infer<typeof businessDashboardSchema>;

export const businessAiDraftSchema = z.object({
  id: idSchema,
  status: z.enum(["draft", "confirmed"]),
  rawContent: longText,
  summary: longText,
  needs: z.array(shortText).max(30),
  facts: z.array(shortText).max(30),
  risks: z.array(shortText).max(30),
  nextActions: z.array(
    z.object({ title: z.string().trim().min(1).max(300), dueAt: nullableTimestampSchema }),
  ),
  createdAt: timestampSchema,
  confirmedAt: nullableTimestampSchema,
});
export type BusinessAiDraft = z.infer<typeof businessAiDraftSchema>;

export const businessListQuerySchema = z.object({
  search: z.string().trim().max(200).default(""),
  includeDeleted: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
