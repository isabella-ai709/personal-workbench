import { aiOpportunityIngestSchema } from "../../../shared/ai-opportunity-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { AiOpportunityRepository } from "./ai-opportunity-repository";

export class AiOpportunityService {
  constructor(
    private readonly repository: AiOpportunityRepository,
    private readonly now = () => new Date().toISOString(),
  ) {}
  ingest(reportId: string, body: unknown) {
    const input = aiOpportunityIngestSchema.parse(body);
    if (input.report.report_id !== reportId)
      throw new WorkbenchError("VALIDATION_ERROR", "路径与小D机会周报 reportId 不一致", 400);
    return this.repository.upsert(input, this.now());
  }
  list() {
    return this.repository.list();
  }
  latest() {
    return this.repository.latest();
  }
  get(reportId: string) {
    const item = this.repository.get(reportId);
    if (!item) throw new WorkbenchError("NOT_FOUND", "小D机会周报不存在", 404);
    return item;
  }
}
