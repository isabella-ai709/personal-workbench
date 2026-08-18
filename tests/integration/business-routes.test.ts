import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { BusinessRepository } from "../../src/server/modules/business/business-repository";
import { BusinessService } from "../../src/server/modules/business/business-service";
import { BusinessAiService } from "../../src/server/modules/business/business-ai";

const now = "2026-08-18T03:00:00.000Z";
const resources: Array<{ app: ReturnType<typeof buildApp>; database: WorkbenchDatabase }> = [];

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.app.close();
    resource.database.close();
  }
});

function setup() {
  const database = openDatabase(":memory:");
  migrateDatabase(database);
  const businessRepository = new BusinessRepository(database, () => now);
  const business = new BusinessService(businessRepository, () => new Date(now));
  const businessAi = new BusinessAiService(businessRepository, {
    extract: async () => ({
      summary: "确认了培训范围和名单交付时间。",
      needs: ["年度培训"],
      facts: ["周五提供名单"],
      risks: ["参训人数待确认"],
      nextActions: [{ title: "周五确认名单", dueAt: "2026-08-21T09:00:00.000Z" }],
    }),
  });
  const app = buildApp(undefined, undefined, undefined, undefined, business, businessAi);
  resources.push({ app, database });
  return { app, database };
}

describe("business routes", () => {
  it("creates resources, advances business, records activity, and aggregates dashboard data", async () => {
    const { app } = setup();
    const companyResponse = await app.inject({
      method: "POST",
      url: "/api/business/companies",
      payload: { name: "云杉健康", industry: "健康服务", tags: ["重点客户"] },
    });
    expect(companyResponse.statusCode).toBe(201);
    const company = companyResponse.json().item;

    const contactResponse = await app.inject({
      method: "POST",
      url: "/api/business/contacts",
      payload: { name: "林悦", companyId: company.id, phone: "13800001111" },
    });
    expect(contactResponse.statusCode).toBe(201);
    const contact = contactResponse.json().item;

    const opportunityResponse = await app.inject({
      method: "POST",
      url: "/api/business/opportunities",
      payload: {
        name: "年度培训项目",
        companyId: company.id,
        primaryContactId: contact.id,
        amountMinor: 12800000,
      },
    });
    const opportunity = opportunityResponse.json();
    expect(opportunity.stage).toBe("lead");

    const stageResponse = await app.inject({
      method: "POST",
      url: `/api/business/opportunities/${opportunity.id}/stage`,
      payload: { stage: "contacted" },
    });
    expect(stageResponse.statusCode).toBe(200);
    expect(stageResponse.json().stage).toBe("contacted");

    const activityResponse = await app.inject({
      method: "POST",
      url: "/api/business/activities",
      headers: { "idempotency-key": "activity-001" },
      payload: {
        summary: "确认培训范围，客户将在周五提供参训名单。",
        companyId: company.id,
        contactId: contact.id,
        opportunityId: opportunity.id,
        occurredAt: now,
      },
    });
    expect(activityResponse.statusCode).toBe(201);

    const followUpResponse = await app.inject({
      method: "POST",
      url: "/api/business/follow-ups",
      payload: {
        title: "周五确认参训名单",
        dueAt: "2026-08-18T08:00:00.000Z",
        companyId: company.id,
        opportunityId: opportunity.id,
      },
    });
    expect(followUpResponse.statusCode).toBe(201);

    const dashboard = await app.inject({ method: "GET", url: "/api/business/dashboard" });
    expect(dashboard.json()).toMatchObject({
      companies: 1,
      contacts: 1,
      opportunities: { active: 1, amountMinor: 12800000 },
      followUps: { dueToday: 1, overdue: 0 },
    });
    expect(dashboard.json().recentActivities).toHaveLength(1);
  });

  it("enforces terminal reasons, active-business deletion rules, and follow-up history", async () => {
    const { app, database } = setup();
    const company = (
      await app.inject({
        method: "POST",
        url: "/api/business/companies",
        payload: { name: "青禾文化" },
      })
    ).json().item;
    const opportunity = (
      await app.inject({
        method: "POST",
        url: "/api/business/opportunities",
        payload: { name: "品牌共创", companyId: company.id },
      })
    ).json();

    const invalidLoss = await app.inject({
      method: "POST",
      url: `/api/business/opportunities/${opportunity.id}/stage`,
      payload: { stage: "lost" },
    });
    expect(invalidLoss.statusCode).toBe(400);

    const deleteBlocked = await app.inject({
      method: "DELETE",
      url: `/api/business/companies/${company.id}`,
    });
    expect(deleteBlocked.statusCode).toBe(409);
    expect(deleteBlocked.json()).toMatchObject({ error: { code: "CONFLICT" } });

    const followUp = (
      await app.inject({
        method: "POST",
        url: "/api/business/follow-ups",
        payload: {
          title: "准备共创方案",
          dueAt: "2026-08-19T03:00:00.000Z",
          companyId: company.id,
        },
      })
    ).json();
    const rescheduled = await app.inject({
      method: "POST",
      url: `/api/business/follow-ups/${followUp.id}/reschedule`,
      payload: { dueAt: "2026-08-20T03:00:00.000Z", reason: "等待对方档期" },
    });
    expect(rescheduled.json().dueAt).toBe("2026-08-20T03:00:00.000Z");
    expect(
      (
        database
          .prepare("SELECT COUNT(*) AS count FROM business_events WHERE entity_id=?")
          .get(followUp.id) as { count: number }
      ).count,
    ).toBe(1);
  });

  it("reports possible duplicate contacts without merging them", async () => {
    const { app } = setup();
    await app.inject({
      method: "POST",
      url: "/api/business/contacts",
      payload: { name: "周岚", email: "zhou@example.com" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/business/contacts",
      payload: { name: "周岚", email: "zhou@example.com" },
    });
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json().possibleDuplicates).toHaveLength(1);
    const list = await app.inject({ method: "GET", url: "/api/business/contacts" });
    expect(list.json().items).toHaveLength(2);
  });

  it("keeps AI output as a draft and confirms it idempotently", async () => {
    const { app, database } = setup();
    const company = (
      await app.inject({
        method: "POST",
        url: "/api/business/companies",
        payload: { name: "远山教育" },
      })
    ).json().item;
    const generated = await app.inject({
      method: "POST",
      url: "/api/business/ai-drafts",
      payload: { rawContent: "客户确认需要年度培训，周五给名单。" },
    });
    expect(generated.statusCode).toBe(201);
    expect(generated.json()).toMatchObject({
      status: "draft",
      summary: "确认了培训范围和名单交付时间。",
    });
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM business_activities").get() as {
          count: number;
        }
      ).count,
    ).toBe(0);

    const confirmPayload = {
      activity: { summary: generated.json().summary, companyId: company.id, occurredAt: now },
      followUps: [
        { title: "周五确认名单", dueAt: "2026-08-21T09:00:00.000Z", companyId: company.id },
      ],
    };
    const first = await app.inject({
      method: "POST",
      url: `/api/business/ai-drafts/${generated.json().id}/confirm`,
      headers: { "idempotency-key": "ai-confirm-001" },
      payload: confirmPayload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().followUps).toHaveLength(1);

    const second = await app.inject({
      method: "POST",
      url: `/api/business/ai-drafts/${generated.json().id}/confirm`,
      headers: { "idempotency-key": "ai-confirm-001" },
      payload: confirmPayload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().activity.id).toBe(first.json().activity.id);
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM business_activities").get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
  });
});
