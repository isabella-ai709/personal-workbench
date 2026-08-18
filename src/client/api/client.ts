import {
  dashboardSummarySchema,
  skillSummarySchema,
  type DashboardSummary,
  type SkillOrigin,
  type SkillSummary,
} from "../../shared/contracts";
import {
  taskPlanSchema,
  type CreateTaskPlanInput,
  type TaskPlan,
  type TaskPlanStatus,
  type UpdateTaskPlanInput,
} from "../../shared/task-plan-contracts";
import { z } from "zod";

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

let sessionToken: string | undefined;

async function getSessionToken(): Promise<string> {
  if (sessionToken) return sessionToken;
  const response = await fetch("/api/session", { headers: { accept: "application/json" } });
  if (!response.ok) throw new ApiClientError("无法建立本机安全会话", response.status);
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) throw new ApiClientError("本机安全会话响应无效", 500);
  sessionToken = payload.token;
  return sessionToken;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  let body = options.body;
  if (mutating) {
    headers.set("content-type", "application/json");
    headers.set("x-workbench-session", await getSessionToken());
    body ??= "{}";
  }
  const response = await fetch(path, { ...options, method, headers, body });
  if (!response.ok) {
    let payload: ErrorEnvelope = {};
    try {
      payload = (await response.json()) as ErrorEnvelope;
    } catch {
      // A stable fallback is more useful than exposing a response parser error.
    }
    throw new ApiClientError(
      payload.error?.message ?? "工作台请求失败",
      response.status,
      payload.error?.code,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getDashboard(): Promise<DashboardSummary> {
  return dashboardSummarySchema.parse(await apiRequest<unknown>("/api/dashboard"));
}

export async function getTaskPlans(includeDeleted = false): Promise<TaskPlan[]> {
  const payload = await apiRequest<unknown>(
    `/api/task-plans?includeDeleted=${String(includeDeleted)}`,
  );
  return taskPlanSchema.array().parse((payload as { items?: unknown }).items);
}

export async function createTaskPlan(input: CreateTaskPlanInput): Promise<TaskPlan> {
  return taskPlanSchema.parse(
    await apiRequest("/api/task-plans", { method: "POST", body: JSON.stringify(input) }),
  );
}

export async function updateTaskPlan(id: string, input: UpdateTaskPlanInput): Promise<TaskPlan> {
  return taskPlanSchema.parse(
    await apiRequest(`/api/task-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function setTaskPlanStatus(id: string, status: TaskPlanStatus): Promise<TaskPlan> {
  return taskPlanSchema.parse(
    await apiRequest(`/api/task-plans/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  );
}

export async function deleteTaskPlan(id: string): Promise<TaskPlan> {
  return taskPlanSchema.parse(await apiRequest(`/api/task-plans/${id}`, { method: "DELETE" }));
}

export async function restoreTaskPlan(id: string): Promise<TaskPlan> {
  return taskPlanSchema.parse(
    await apiRequest(`/api/task-plans/${id}/restore`, { method: "POST" }),
  );
}

export interface SkillDetail extends SkillSummary {
  content: string;
}

export async function getSkills(): Promise<SkillSummary[]> {
  const payload = await apiRequest<unknown>("/api/skills");
  return skillSummarySchema.array().parse((payload as { items?: unknown }).items);
}

export async function getSkill(id: string): Promise<SkillDetail> {
  return skillSummarySchema
    .extend({ content: z.string() })
    .parse(await apiRequest(`/api/skills/${id}`));
}

export async function setSkillEnabled(id: string, enabled: boolean): Promise<SkillSummary> {
  return skillSummarySchema.parse(
    await apiRequest(`/api/skills/${id}/${enabled ? "enable" : "disable"}`, { method: "POST" }),
  );
}

export async function setSkillOrigin(
  id: string,
  origin: Extract<SkillOrigin, "generated" | "installed" | "unconfirmed">,
): Promise<SkillSummary> {
  return skillSummarySchema.parse(
    await apiRequest(`/api/skills/${id}/origin`, {
      method: "PATCH",
      body: JSON.stringify({ origin }),
    }),
  );
}

export async function openSkillFolder(id: string): Promise<void> {
  await apiRequest(`/api/skills/${id}/open-folder`, { method: "POST" });
}

export async function deleteSkill(id: string): Promise<void> {
  await apiRequest(`/api/skills/${id}`, { method: "DELETE" });
}
