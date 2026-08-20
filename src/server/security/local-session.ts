import { randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import { WorkbenchError } from "../../shared/errors";

const SESSION_HEADER = "x-workbench-session";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface LocalSessionOptions {
  origin: string;
  token?: string;
  integrationToken?: string;
}

export class LocalSession {
  readonly token: string;
  readonly origin: string;
  private readonly integrationToken?: string;

  constructor(options: LocalSessionOptions) {
    this.origin = new URL(options.origin).origin;
    this.token = options.token ?? randomBytes(32).toString("base64url");
    this.integrationToken = options.integrationToken;
  }

  register(app: FastifyInstance): void {
    app.addHook("onRequest", async (request, reply) => {
      reply.headers({
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
        "cross-origin-resource-policy": "same-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      });

      const requestOrigin = request.headers.origin;
      if (
        isAiNewsIntegrationRequest(request) &&
        !requestOrigin &&
        hasJsonContentType(request) &&
        matchesBearerToken(request.headers.authorization, this.integrationToken)
      ) {
        return;
      }
      if (requestOrigin && requestOrigin !== this.origin) {
        throw new WorkbenchError("FORBIDDEN", "Cross-origin requests are not allowed", 403);
      }

      if (!MUTATING_METHODS.has(request.method)) return;
      if (!requestOrigin) {
        throw new WorkbenchError("FORBIDDEN", "A same-origin request is required", 403);
      }
      if (!hasJsonContentType(request)) {
        throw new WorkbenchError("VALIDATION_ERROR", "JSON content type is required", 415);
      }
      if (!matchesToken(request.headers[SESSION_HEADER], this.token)) {
        throw new WorkbenchError("FORBIDDEN", "A valid workbench session is required", 403);
      }
    });

    app.get("/api/session", async () => ({ token: this.token }));
  }
}

function isAiNewsIntegrationRequest(request: FastifyRequest): boolean {
  return (
    request.method === "PUT" &&
    request.routeOptions.url === "/api/integrations/ai-news/reports/:reportId"
  );
}

function hasJsonContentType(request: FastifyRequest): boolean {
  const contentType = request.headers["content-type"];
  return typeof contentType === "string" && /^application\/json(?:\s*;|$)/i.test(contentType);
}

function matchesToken(candidate: string | string[] | undefined, expected: string): boolean {
  if (typeof candidate !== "string") return false;
  const actualBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function matchesBearerToken(
  authorization: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  return matchesToken(authorization.slice("Bearer ".length), expected);
}
