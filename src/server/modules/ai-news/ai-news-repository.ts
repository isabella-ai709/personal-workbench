import type {
  AiNewsIngest,
  AiNewsReportDetail,
  AiNewsReportListItem,
} from "../../../shared/ai-news-contracts";
import { aiNewsReportSchema } from "../../../shared/ai-news-contracts";
import type { WorkbenchDatabase } from "../../db/connection";

interface AiNewsReportRow {
  report_id: string;
  schema_version: number;
  title: string;
  year: number;
  week: number;
  start_date: string;
  end_date: string;
  created_at: string;
  imported_at: string;
  article_count: number;
  source_count: number;
  duration_seconds: number;
  failed_sources: number;
  payload_json: string;
}

function mapListItem(row: AiNewsReportRow): AiNewsReportListItem {
  return {
    reportId: row.report_id,
    title: row.title,
    year: row.year,
    week: row.week,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    importedAt: row.imported_at,
    articleCount: row.article_count,
    sourceCount: row.source_count,
    durationSeconds: row.duration_seconds,
    failedSources: row.failed_sources,
  };
}

function mapDetail(row: AiNewsReportRow): AiNewsReportDetail {
  return {
    ...mapListItem(row),
    schemaVersion: 1,
    report: aiNewsReportSchema.parse(JSON.parse(row.payload_json)),
  };
}

export class AiNewsRepository {
  constructor(private readonly database: WorkbenchDatabase) {}

  upsert(input: AiNewsIngest, importedAt: string): AiNewsReportDetail {
    const { report, schemaVersion } = input;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `INSERT INTO ai_news_reports (
            report_id, schema_version, title, year, week, start_date, end_date,
            created_at, imported_at, article_count, source_count, duration_seconds,
            failed_sources, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(report_id) DO UPDATE SET
            schema_version = excluded.schema_version,
            title = excluded.title,
            year = excluded.year,
            week = excluded.week,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            created_at = excluded.created_at,
            imported_at = excluded.imported_at,
            article_count = excluded.article_count,
            source_count = excluded.source_count,
            duration_seconds = excluded.duration_seconds,
            failed_sources = excluded.failed_sources,
            payload_json = excluded.payload_json`,
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
          report.article_count,
          report.source_count,
          report.stats.duration_seconds,
          report.stats.failed_sources,
          JSON.stringify(report),
        );
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.get(report.report_id)!;
  }

  list(): AiNewsReportListItem[] {
    return (
      this.database
        .prepare("SELECT * FROM ai_news_reports ORDER BY year DESC, week DESC, imported_at DESC")
        .all() as unknown as AiNewsReportRow[]
    ).map(mapListItem);
  }

  latest(): AiNewsReportDetail | null {
    const row = this.database
      .prepare(
        "SELECT * FROM ai_news_reports ORDER BY year DESC, week DESC, imported_at DESC LIMIT 1",
      )
      .get() as AiNewsReportRow | undefined;
    return row ? mapDetail(row) : null;
  }

  get(reportId: string): AiNewsReportDetail | null {
    const row = this.database
      .prepare("SELECT * FROM ai_news_reports WHERE report_id = ?")
      .get(reportId) as AiNewsReportRow | undefined;
    return row ? mapDetail(row) : null;
  }
}
