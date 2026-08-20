import { aiNewsIngestSchema, type AiNewsReportDetail } from "../../../shared/ai-news-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { AiNewsRepository } from "./ai-news-repository";

export class AiNewsService {
  constructor(
    private readonly repository: AiNewsRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  ingest(reportId: string, body: unknown): AiNewsReportDetail {
    if (
      typeof body === "object" &&
      body !== null &&
      "schemaVersion" in body &&
      body.schemaVersion !== 1
    ) {
      throw new WorkbenchError("VALIDATION_ERROR", "不支持的 AI 周报协议版本", 422);
    }
    const input = aiNewsIngestSchema.parse(body);
    if (input.report.report_id !== reportId) {
      throw new WorkbenchError("VALIDATION_ERROR", "路径与周报 reportId 不一致", 400);
    }
    return this.repository.upsert(input, this.now());
  }

  list() {
    return this.repository.list();
  }

  latest(): AiNewsReportDetail | null {
    return this.repository.latest();
  }

  get(reportId: string): AiNewsReportDetail {
    const report = this.repository.get(reportId);
    if (!report) throw new WorkbenchError("NOT_FOUND", "AI 周报不存在", 404);
    return report;
  }
}
