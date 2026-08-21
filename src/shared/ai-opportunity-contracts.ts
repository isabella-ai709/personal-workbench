import { z } from "zod";

const text = z.string().max(20_000);
const evidenceSchema = z.object({ source: text, published_at: text, url: z.url() });

export const aiOpportunityReportSchema = z
  .object({
    report_id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    week: z.number().int().min(1).max(53),
    year: z.number().int().min(2000).max(2200),
    start_date: text,
    end_date: text,
    created_at: z.iso.datetime({ offset: true }),
    category: z.literal("小D机会"),
    summary: text,
    money_judgment: text,
    radar_items: z.array(
      z
        .object({
          id: text,
          title: text,
          industry: text,
          what_happened: text,
          business_judgment: text,
          immediate_action: text,
          matched_terms: z.array(text),
          evidence: evidenceSchema,
        })
        .passthrough(),
    ),
    case_studies: z.array(z.record(z.string(), z.unknown())),
    sales_kit: z.record(z.string(), z.unknown()),
    side_hustles: z.array(
      z
        .object({
          id: text,
          title: text,
          industry: text,
          offer: text,
          customer: text,
          payment_reason: text,
          copy_target: text,
          materials: z.array(text),
          first_steps: z.array(text),
          risk: text,
          difficulty: text,
          money_distance: text,
          evidence: evidenceSchema,
        })
        .passthrough(),
    ),
    ranking: z.array(
      z
        .object({
          rank: z.number().int(),
          opportunity_id: text,
          title: text,
          difficulty: text,
          money_distance: text,
          reason: text,
        })
        .passthrough(),
    ),
    recommended_opportunity_id: z.string().nullable(),
    matched_must_track_terms: z.array(text),
    stats: z
      .object({
        source_count: z.number().int().nonnegative(),
        failed_sources: z.number().int().nonnegative(),
        duration_seconds: z.number().nonnegative(),
      })
      .passthrough(),
    source_errors: z.array(z.record(z.string(), z.unknown())),
    markdown_content: z.string().max(2_000_000),
    html_content: z.string().max(2_000_000),
    publish_status: text,
    publish_error: text,
  })
  .passthrough();

export const aiOpportunityIngestSchema = z.object({
  schemaVersion: z.literal(1),
  report: aiOpportunityReportSchema,
});

export const aiOpportunityListItemSchema = z.object({
  reportId: z.string(),
  title: z.string(),
  year: z.number().int(),
  week: z.number().int(),
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string(),
  importedAt: z.string(),
  sourceCount: z.number().int().nonnegative(),
  failedSources: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  opportunityCount: z.number().int().nonnegative(),
});

export const aiOpportunityDetailSchema = aiOpportunityListItemSchema.extend({
  schemaVersion: z.literal(1),
  report: aiOpportunityReportSchema,
});

export type AiOpportunityIngest = z.infer<typeof aiOpportunityIngestSchema>;
export type AiOpportunityReport = z.infer<typeof aiOpportunityReportSchema>;
export type AiOpportunityListItem = z.infer<typeof aiOpportunityListItemSchema>;
export type AiOpportunityDetail = z.infer<typeof aiOpportunityDetailSchema>;
