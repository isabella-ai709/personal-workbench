import { z } from "zod";

const shortText = z.string().trim().max(2_000);
const longText = z.string().max(2_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonNegativeInt = z.number().int().nonnegative();

export const aiNewsEventSchema = z
  .object({
    id: shortText,
    title: z.string().trim().min(1).max(500),
    original_title: shortText.default(""),
    published_at: z.iso.datetime({ offset: true }),
    main_source: shortText,
    main_url: z.url(),
    source_grade: z.enum(["S", "A", "B", "C"]).or(shortText),
    summary: z.string().trim().max(20_000),
    category: shortText,
    hot_score: z.number().finite(),
    importance: shortText,
    confidence: z.number().min(0).max(1),
    tags: z.array(shortText).max(100).default([]),
    related_sources: z.array(z.record(z.string(), z.string())).max(100).default([]),
    article_ids: z.array(shortText).max(1_000).default([]),
    image_url: z.string().max(4_000).default(""),
    image_source: shortText.default(""),
    image_alt: shortText.default(""),
    image_type: shortText.default(""),
    why_important: z.string().max(20_000).default(""),
    impact_for_people: z.string().max(20_000).default(""),
    business_value: z.string().max(20_000).default(""),
    translation_status: shortText.default("not_needed"),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

export const aiNewsBusinessOpportunitySchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20_000),
    payer: shortText,
    offer: z.string().max(20_000),
    mvp: z.string().max(20_000),
    difficulty: shortText,
    competition: shortText,
    stage: shortText,
    rating: z.number().int().min(0).max(10),
    reason: z.string().max(20_000),
    evidence_event_ids: z.array(shortText).max(100).default([]),
  })
  .passthrough();

export const aiNewsTrendSignalSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    judgment: z.string().max(20_000),
    evidence: z.array(z.string().max(2_000)).max(100),
    event_ids: z.array(shortText).max(100),
  })
  .passthrough();

export const aiNewsStatsSchema = z
  .object({
    source_count: nonNegativeInt,
    successful_sources: nonNegativeInt,
    failed_sources: nonNegativeInt,
    raw_article_count: nonNegativeInt,
    time_filtered_count: nonNegativeInt,
    url_deduplicated_count: nonNegativeInt,
    title_deduplicated_count: nonNegativeInt,
    event_count: nonNegativeInt,
    candidate_count: nonNegativeInt,
    report_event_count: nonNegativeInt,
    llm_calls: nonNegativeInt,
    summary_min_length: nonNegativeInt,
    summary_max_length: nonNegativeInt,
    summary_average_length: z.number().nonnegative(),
    summaries_under_70: nonNegativeInt,
    duration_seconds: z.number().nonnegative(),
  })
  .passthrough();

export const aiNewsReportSchema = z
  .object({
    report_id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    week: z.number().int().min(1).max(53),
    year: z.number().int().min(2000).max(2200),
    start_date: isoDate,
    end_date: isoDate,
    created_at: z.iso.datetime({ offset: true }),
    published_at: z.iso.datetime({ offset: true }).nullable(),
    category: z.literal("AI新闻资讯"),
    summary: z.string().max(20_000),
    cover_image: z.string().max(4_000).default(""),
    hot_topics: z.array(shortText).max(100),
    top_events: z.array(aiNewsEventSchema).max(1_000),
    product_events: z.array(aiNewsEventSchema).max(1_000),
    tool_events: z.array(aiNewsEventSchema).max(1_000),
    open_source_events: z.array(aiNewsEventSchema).max(1_000),
    business_opportunities: z.array(aiNewsBusinessOpportunitySchema).max(200),
    trend_signals: z.array(aiNewsTrendSignalSchema).max(200),
    next_week_watch: z.array(z.string().max(20_000)).max(200),
    weekly_judgment: z.string().max(20_000),
    companies: z.array(shortText).max(1_000),
    products: z.array(shortText).max(1_000),
    models: z.array(shortText).max(1_000),
    technologies: z.array(shortText).max(1_000),
    keywords: z.array(shortText).max(1_000),
    article_count: nonNegativeInt,
    source_count: nonNegativeInt,
    stats: aiNewsStatsSchema,
    source_errors: z.array(z.record(z.string(), z.unknown())).max(1_000),
    markdown_content: longText,
    html_content: longText,
    raw_data: z.record(z.string(), z.unknown()),
    publish_status: z.enum(["pending", "published", "failed"]),
    publish_error: z.string().max(20_000),
  })
  .passthrough();

export const aiNewsIngestSchema = z.object({
  schemaVersion: z.literal(1),
  report: aiNewsReportSchema,
});

export const aiNewsReportListItemSchema = z.object({
  reportId: z.string(),
  title: z.string(),
  year: z.number().int(),
  week: z.number().int(),
  startDate: isoDate,
  endDate: isoDate,
  createdAt: z.iso.datetime({ offset: true }),
  importedAt: z.iso.datetime({ offset: true }),
  articleCount: nonNegativeInt,
  sourceCount: nonNegativeInt,
  durationSeconds: z.number().nonnegative(),
  failedSources: nonNegativeInt,
});

export const aiNewsReportDetailSchema = aiNewsReportListItemSchema.extend({
  schemaVersion: z.literal(1),
  report: aiNewsReportSchema,
});

export const aiNewsIngestResultSchema = z.object({
  reportId: z.string(),
  status: z.literal("published"),
  importedAt: z.iso.datetime({ offset: true }),
});

export type AiNewsEvent = z.infer<typeof aiNewsEventSchema>;
export type AiNewsReport = z.infer<typeof aiNewsReportSchema>;
export type AiNewsIngest = z.infer<typeof aiNewsIngestSchema>;
export type AiNewsReportListItem = z.infer<typeof aiNewsReportListItemSchema>;
export type AiNewsReportDetail = z.infer<typeof aiNewsReportDetailSchema>;
