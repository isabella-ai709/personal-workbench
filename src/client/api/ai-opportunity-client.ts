import {
  aiOpportunityDetailSchema,
  aiOpportunityListItemSchema,
  type AiOpportunityDetail,
  type AiOpportunityListItem,
} from "../../shared/ai-opportunity-contracts";
import { apiRequest } from "./client";

export async function getAiOpportunityReports(): Promise<AiOpportunityListItem[]> {
  const payload = await apiRequest<unknown>("/api/ai-opportunities/reports");
  return aiOpportunityListItemSchema.array().parse((payload as { items?: unknown }).items);
}
export async function getLatestAiOpportunityReport(): Promise<AiOpportunityDetail | null> {
  const payload = (await apiRequest<unknown>("/api/ai-opportunities/reports/latest")) as {
    item?: unknown;
  };
  return payload.item === null ? null : aiOpportunityDetailSchema.parse(payload.item);
}
export async function getAiOpportunityReport(reportId: string): Promise<AiOpportunityDetail> {
  return aiOpportunityDetailSchema.parse(
    await apiRequest(`/api/ai-opportunities/reports/${encodeURIComponent(reportId)}`),
  );
}
