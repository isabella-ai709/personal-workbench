import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { AiOpportunityRepository } from "../../src/server/modules/ai-opportunities/ai-opportunity-repository";
import { AiOpportunityService } from "../../src/server/modules/ai-opportunities/ai-opportunity-service";
import { LocalSession } from "../../src/server/security/local-session";
import { aiOpportunityIngestFixture } from "../fixtures/ai-opportunity-report";

const apps: Array<ReturnType<typeof buildApp>> = [];
const databases: WorkbenchDatabase[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  databases.splice(0).forEach((db) => db.close());
});

function setup() {
  const database = openDatabase(":memory:");
  databases.push(database);
  migrateDatabase(database);
  const service = new AiOpportunityService(
    new AiOpportunityRepository(database),
    () => "2026-08-21T09:05:00.000Z",
  );
  const app = buildApp(
    undefined,
    undefined,
    new LocalSession({ origin: "http://127.0.0.1:4310", integrationToken: "integration-token" }),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
  );
  apps.push(app);
  return app;
}

describe("AI opportunity routes", () => {
  it("authenticates, upserts idempotently, and exposes reads", async () => {
    const app = setup();
    const payload = aiOpportunityIngestFixture();
    const request = () =>
      app.inject({
        method: "PUT",
        url: `/api/integrations/ai-opportunities/reports/${payload.report.report_id}`,
        headers: { authorization: "Bearer integration-token", "content-type": "application/json" },
        payload,
      });
    expect((await request()).statusCode).toBe(200);
    expect((await request()).statusCode).toBe(200);
    expect(
      (await app.inject({ method: "GET", url: "/api/ai-opportunities/reports" })).json().items,
    ).toHaveLength(1);
    expect(
      (await app.inject({ method: "GET", url: "/api/ai-opportunities/reports/latest" })).json().item
        .opportunityCount,
    ).toBe(1);
  });
  it("rejects missing bearer authentication and mismatched ids", async () => {
    const app = setup();
    const payload = aiOpportunityIngestFixture();
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/api/integrations/ai-opportunities/reports/${payload.report.report_id}`,
          headers: { "content-type": "application/json" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/integrations/ai-opportunities/reports/wrong",
          headers: {
            authorization: "Bearer integration-token",
            "content-type": "application/json",
          },
          payload,
        })
      ).statusCode,
    ).toBe(400);
  });
});
