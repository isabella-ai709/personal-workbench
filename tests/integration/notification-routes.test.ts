import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { BusinessRepository } from "../../src/server/modules/business/business-repository";
import { BusinessService } from "../../src/server/modules/business/business-service";
import { NotificationRepository } from "../../src/server/modules/notifications/notification-repository";
import { NotificationScanner } from "../../src/server/modules/notifications/notification-scanner";
import { NotificationService } from "../../src/server/modules/notifications/notification-service";
import { TaskPlanRepository } from "../../src/server/modules/task-plans/task-plan-repository";
import { TaskPlanService } from "../../src/server/modules/task-plans/task-plan-service";

const resources: Array<{ app: ReturnType<typeof buildApp>; database: WorkbenchDatabase }> = [];
const now = "2026-08-20T01:00:00.000Z";

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.app.close();
    resource.database.close();
  }
});

function setup() {
  const database = openDatabase(":memory:");
  migrateDatabase(database);
  const taskPlans = new TaskPlanService(
    new TaskPlanRepository(database, () => now),
    () => new Date(now),
  );
  const business = new BusinessService(
    new BusinessRepository(database, () => now),
    () => new Date(now),
  );
  const repository = new NotificationRepository(database, () => now);
  const scanner = new NotificationScanner(repository, taskPlans, business, () => new Date(now));
  const notifications = new NotificationService(
    repository,
    scanner,
    taskPlans,
    business,
    () => new Date(now),
  );
  const app = buildApp(
    taskPlans,
    undefined,
    undefined,
    undefined,
    business,
    undefined,
    undefined,
    undefined,
    undefined,
    notifications,
  );
  resources.push({ app, database });
  return { app, taskPlans, business };
}

describe("notification routes", () => {
  it("discovers three-day task and seven-day business deadlines without duplicates", async () => {
    const { app, taskPlans, business } = setup();
    taskPlans.create({ title: "交付方案", dueAt: "2026-08-23T10:00:00+08:00" });
    business.createPartnership({
      name: "渠道合作",
      targetEndAt: "2026-08-27T10:00:00+08:00",
    });
    business.createFollowUp({ title: "确认合同", dueAt: "2026-08-27T11:00:00+08:00" });

    const first = await app.inject({ method: "GET", url: "/api/notifications?view=unread" });
    expect(first.statusCode).toBe(200);
    expect(first.json().items).toHaveLength(3);
    expect(first.json().items.map((item: { severity: string }) => item.severity)).toEqual([
      "important",
      "important",
      "important",
    ]);
    expect(
      (await app.inject({ method: "GET", url: "/api/notifications?view=unread" })).json().items,
    ).toHaveLength(3);
    expect((await app.inject({ method: "GET", url: "/api/notifications/summary" })).json()).toEqual(
      { importantUnread: 3, totalUnread: 3 },
    );
  });

  it("supports status, snooze, and task actions", async () => {
    const { app, taskPlans } = setup();
    const task = taskPlans.create({ title: "准备发布", dueAt: "2026-08-23T10:00:00+08:00" });
    const list = await app.inject({ method: "GET", url: "/api/notifications?view=unread" });
    const notification = list.json().items[0] as { id: string };

    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/notifications/${notification.id}/status`,
          payload: { status: "read" },
        })
      ).json().status,
    ).toBe("read");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/notifications/${notification.id}/snooze`,
          payload: { until: "2026-08-21T01:00:00.000Z" },
        })
      ).json().status,
    ).toBe("snoozed");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/notifications/${notification.id}/actions`,
          payload: { action: "advance" },
        })
      ).json().status,
    ).toBe("resolved");
    expect(taskPlans.get(task.id).status).toBe("in_progress");
  });
});
