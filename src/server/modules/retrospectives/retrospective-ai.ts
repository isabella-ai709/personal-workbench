import type {
  Retrospective,
  RetrospectiveAiAnalysis,
} from "../../../shared/retrospective-contracts";
import { WorkbenchError } from "../../../shared/errors";

export interface RetrospectiveAiService {
  analyze(retrospective: Retrospective): Promise<RetrospectiveAiAnalysis>;
}

export class UnconfiguredRetrospectiveAiService implements RetrospectiveAiService {
  async analyze(): Promise<RetrospectiveAiAnalysis> {
    throw new WorkbenchError("UNAVAILABLE", "经验复盘 AI 分析尚未配置，请先配置 AI 服务", 503);
  }
}
