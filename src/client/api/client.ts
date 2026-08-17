import { dashboardSummarySchema, type DashboardSummary } from "../../shared/contracts";

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
