import {
  aiNewsReportDetailSchema,
  aiNewsReportListItemSchema,
  type AiNewsReportDetail,
  type AiNewsReportListItem,
} from "../../shared/ai-news-contracts";
import { apiRequest } from "./client";

export async function getAiNewsReports(): Promise<AiNewsReportListItem[]> {
  const payload = await apiRequest<unknown>("/api/ai-news/reports");
  return aiNewsReportListItemSchema.array().parse((payload as { items?: unknown }).items);
}

export async function getLatestAiNewsReport(): Promise<AiNewsReportDetail | null> {
  const payload = (await apiRequest<unknown>("/api/ai-news/reports/latest")) as {
    item?: unknown;
  };
  return payload.item === null ? null : aiNewsReportDetailSchema.parse(payload.item);
}

export async function getAiNewsReport(reportId: string): Promise<AiNewsReportDetail> {
  return aiNewsReportDetailSchema.parse(
    await apiRequest(`/api/ai-news/reports/${encodeURIComponent(reportId)}`),
  );
}
