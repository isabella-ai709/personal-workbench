import type {
  AiOpportunityDetail,
  AiOpportunityIngest,
  AiOpportunityListItem,
} from "../../../shared/ai-opportunity-contracts";
import { aiOpportunityReportSchema } from "../../../shared/ai-opportunity-contracts";
import type { WorkbenchDatabase } from "../../db/connection";
import type { NotificationRepository } from "../notifications/notification-repository";

interface Row {
  report_id: string;
  schema_version: number;
  title: string;
  year: number;
  week: number;
  start_date: string;
  end_date: string;
  created_at: string;
  imported_at: string;
  source_count: number;
  failed_sources: number;
  duration_seconds: number;
  opportunity_count: number;
  payload_json: string;
}

const listItem = (row: Row): AiOpportunityListItem => ({
  reportId: row.report_id,
  title: row.title,
  year: row.year,
  week: row.week,
  startDate: row.start_date,
  endDate: row.end_date,
  createdAt: row.created_at,
  importedAt: row.imported_at,
  sourceCount: row.source_count,
  failedSources: row.failed_sources,
  durationSeconds: row.duration_seconds,
  opportunityCount: row.opportunity_count,
});

const detail = (row: Row): AiOpportunityDetail => ({
  ...listItem(row),
  schemaVersion: 1,
  report: aiOpportunityReportSchema.parse(JSON.parse(row.payload_json)),
});

export class AiOpportunityRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly notifications?: NotificationRepository,
  ) {}

  upsert(input: AiOpportunityIngest, importedAt: string): AiOpportunityDetail {
    const { report, schemaVersion } = input;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `INSERT INTO ai_opportunity_reports (
        report_id, schema_version, title, year, week, start_date, end_date, created_at,
        imported_at, source_count, failed_sources, duration_seconds, opportunity_count, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(report_id) DO UPDATE SET schema_version=excluded.schema_version,
        title=excluded.title, year=excluded.year, week=excluded.week,
        start_date=excluded.start_date, end_date=excluded.end_date,
        created_at=excluded.created_at, imported_at=excluded.imported_at,
        source_count=excluded.source_count, failed_sources=excluded.failed_sources,
        duration_seconds=excluded.duration_seconds, opportunity_count=excluded.opportunity_count,
        payload_json=excluded.payload_json`,
        )
        .run(
          report.report_id,
          schemaVersion,
          report.title,
          report.year,
          report.week,
          report.start_date,
          report.end_date,
          report.created_at,
          importedAt,
          report.stats.source_count,
          report.stats.failed_sources,
          report.stats.duration_seconds,
          report.side_hustles.length,
          JSON.stringify(report),
        );
      this.notifications?.publish({
        sourceModule: "ai_opportunities",
        sourceType: "ai_opportunity_report",
        sourceId: report.report_id,
        eventType: "report_published",
        sourceVersion: report.report_id,
        title: `小D机会周报已生成：${report.title}`,
        body: `本期整理 ${report.side_hustles.length} 个可执行机会。`,
        severity: "normal",
        occurredAt: importedAt,
        metadata: { href: "/ai-news/opportunities", sourceLabel: "小D机会" },
      });
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.get(report.report_id)!;
  }

  list(): AiOpportunityListItem[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM ai_opportunity_reports ORDER BY year DESC, week DESC, imported_at DESC",
        )
        .all() as unknown as Row[]
    ).map(listItem);
  }
  latest(): AiOpportunityDetail | null {
    const row = this.database
      .prepare(
        "SELECT * FROM ai_opportunity_reports ORDER BY year DESC, week DESC, imported_at DESC LIMIT 1",
      )
      .get() as Row | undefined;
    return row ? detail(row) : null;
  }
  get(reportId: string): AiOpportunityDetail | null {
    const row = this.database
      .prepare("SELECT * FROM ai_opportunity_reports WHERE report_id = ?")
      .get(reportId) as Row | undefined;
    return row ? detail(row) : null;
  }
}
