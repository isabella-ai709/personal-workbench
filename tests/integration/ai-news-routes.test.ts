import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { AiNewsRepository } from "../../src/server/modules/ai-news/ai-news-repository";
import { AiNewsService } from "../../src/server/modules/ai-news/ai-news-service";
import { NotificationRepository } from "../../src/server/modules/notifications/notification-repository";
import { NotificationService } from "../../src/server/modules/notifications/notification-service";
import { LocalSession } from "../../src/server/security/local-session";
import { aiNewsIngestFixture } from "../fixtures/ai-news-report";

const apps: Array<ReturnType<typeof buildApp>> = [];
const databases: WorkbenchDatabase[] = [];
const origin = "http://127.0.0.1:4310";
const integrationToken = "integration-token-with-enough-entropy";

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  databases.splice(0).forEach((database) => database.close());
});

function setup() {
  const database = openDatabase(":memory:");
  databases.push(database);
  migrateDatabase(database);
  const notifications = new NotificationRepository(database, () => "2026-08-19T06:03:00.000Z");
  const service = new AiNewsService(
    new AiNewsRepository(database, notifications),
    () => "2026-08-19T06:03:00.000Z",
  );
  const app = buildApp(
    undefined,
    undefined,
    new LocalSession({ origin, integrationToken }),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
    new NotificationService(notifications, undefined, undefined, undefined),
  );
  apps.push(app);
  return app;
}

function ingestionHeaders() {
  return {
    authorization: `Bearer ${integrationToken}`,
    "content-type": "application/json",
  };
}

describe("AI news routes", () => {
  it("ingests idempotently and exposes list, latest, and detail reads", async () => {
    const app = setup();
    const payload = aiNewsIngestFixture();
    const put = () =>
      app.inject({
        method: "PUT",
        url: `/api/integrations/ai-news/reports/${payload.report.report_id}`,
        headers: ingestionHeaders(),
        payload,
      });

    expect((await put()).json()).toEqual({
      reportId: payload.report.report_id,
      status: "published",
      importedAt: "2026-08-19T06:03:00.000Z",
    });
    expect((await put()).statusCode).toBe(200);
    const messages = await app.inject({ method: "GET", url: "/api/notifications?view=all" });
    expect(messages.json().items).toHaveLength(1);
    expect(messages.json().items[0]).toMatchObject({
      sourceType: "ai_news_report",
      severity: "normal",
      status: "unread",
    });
    expect(
      (await app.inject({ method: "GET", url: "/api/ai-news/reports" })).json().items,
    ).toHaveLength(1);
    expect(
      (await app.inject({ method: "GET", url: "/api/ai-news/reports/latest" })).json().item.report
        .report_id,
    ).toBe(payload.report.report_id);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/ai-news/reports/${payload.report.report_id}`,
        })
      ).statusCode,
    ).toBe(200);
  });

  it("returns an explicit empty latest result", async () => {
    const app = setup();
    expect(
      (await app.inject({ method: "GET", url: "/api/ai-news/reports/latest" })).json(),
    ).toEqual({
      item: null,
    });
  });

  it("rejects mismatched ids and unsupported schema versions without writing", async () => {
    const app = setup();
    const mismatch = await app.inject({
      method: "PUT",
      url: "/api/integrations/ai-news/reports/different",
      headers: ingestionHeaders(),
      payload: aiNewsIngestFixture(),
    });
    expect(mismatch.statusCode).toBe(400);

    const unsupported = await app.inject({
      method: "PUT",
      url: "/api/integrations/ai-news/reports/ai-weekly-2026-W34",
      headers: ingestionHeaders(),
      payload: { ...aiNewsIngestFixture(), schemaVersion: 2 },
    });
    expect(unsupported.statusCode).toBe(422);
    expect((await app.inject({ method: "GET", url: "/api/ai-news/reports" })).json().items).toEqual(
      [],
    );
  });
});
