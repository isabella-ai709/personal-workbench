import type { AiOpportunityIngest } from "../../src/shared/ai-opportunity-contracts";

export function aiOpportunityIngestFixture(
  reportId = "xiaod-opportunities-2026-W34",
): AiOpportunityIngest {
  const evidence = {
    source: "Intercom",
    published_at: "2026-08-17",
    url: "https://www.intercom.com/changes/en",
  };
  return {
    schemaVersion: 1,
    report: {
      report_id: reportId,
      title: "小D机会｜2026年第34周",
      week: 34,
      year: 2026,
      start_date: "2026-08-14",
      end_date: "2026-08-21",
      created_at: "2026-08-21T17:00:00+08:00",
      category: "小D机会",
      summary: "筛出一条商业信号。",
      money_judgment: "先验证客服自动化需求。",
      radar_items: [
        {
          id: "event-1",
          title: "Intercom Fin 更新",
          industry: "AI类知识付费",
          what_happened: "新增自动化能力。",
          business_judgment: "可减少重复客服。",
          immediate_action: "访谈三位客户。",
          matched_terms: ["Intercom Fin"],
          evidence,
        },
      ],
      case_studies: [],
      sales_kit: { status: "analysis", moments_copy: "建议文案" },
      side_hustles: [
        {
          id: "hustle-event-1",
          title: "客服流程诊断包",
          industry: "AI类知识付费",
          offer: "流程诊断",
          customer: "课程主理人",
          payment_reason: "减少重复客服",
          copy_target: "Intercom Fin 更新",
          materials: ["流程图"],
          first_steps: ["客户访谈"],
          risk: "先验证需求",
          difficulty: "低",
          money_distance: "近",
          evidence,
        },
      ],
      ranking: [
        {
          rank: 1,
          opportunity_id: "hustle-event-1",
          title: "客服流程诊断包",
          difficulty: "低",
          money_distance: "近",
          reason: "可手工交付",
        },
      ],
      recommended_opportunity_id: "hustle-event-1",
      matched_must_track_terms: ["Intercom Fin"],
      stats: { source_count: 12, failed_sources: 0, duration_seconds: 12.5 },
      source_errors: [],
      markdown_content: "# 小D机会",
      html_content: "<h1>小D机会</h1>",
      publish_status: "pending",
      publish_error: "",
    },
  };
}
