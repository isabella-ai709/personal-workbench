import {
  retrospectiveSchema,
  type CreateRetrospectiveInput,
  type Retrospective,
  retrospectiveAiAnalysisSchema,
  type RetrospectiveAiAnalysis,
  type UpdateRetrospectiveInput,
} from "../../shared/retrospective-contracts";
import { apiRequest } from "./client";

export async function getRetrospectives(): Promise<Retrospective[]> {
  const payload = await apiRequest<unknown>("/api/retrospectives");
  return retrospectiveSchema.array().parse((payload as { items?: unknown }).items);
}

export async function createRetrospective(input: CreateRetrospectiveInput): Promise<Retrospective> {
  return retrospectiveSchema.parse(
    await apiRequest("/api/retrospectives", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function updateRetrospective(
  id: string,
  input: UpdateRetrospectiveInput,
): Promise<Retrospective> {
  return retrospectiveSchema.parse(
    await apiRequest(`/api/retrospectives/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteRetrospective(id: string): Promise<Retrospective> {
  return retrospectiveSchema.parse(
    await apiRequest(`/api/retrospectives/${id}`, { method: "DELETE" }),
  );
}

export async function analyzeRetrospective(id: string): Promise<RetrospectiveAiAnalysis> {
  return retrospectiveAiAnalysisSchema.parse(
    await apiRequest(`/api/retrospectives/${id}/ai-analysis`, { method: "POST" }),
  );
}
