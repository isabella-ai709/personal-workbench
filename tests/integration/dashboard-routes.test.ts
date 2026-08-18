import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { DashboardService } from "../../src/server/modules/dashboard/dashboard-service";
import type { SkillService } from "../../src/server/modules/skills/skill-service";
import { TaskPlanRepository } from "../../src/server/modules/task-plans/task-plan-repository";
import { TaskPlanService } from "../../src/server/modules/task-plans/task-plan-service";

const resources: Array<{ app: ReturnType<typeof buildApp>; database: WorkbenchDatabase }> = [];

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.app.close();
    resource.database.close();
  }
});

describe("dashboard routes", () => {
  it("returns personal task plan counts and recent ideas", async () => {
    const database = openDatabase(":memory:");
    migrateDatabase(database);
    const now = "2026-08-18T01:00:00.000Z";
    const repository = new TaskPlanRepository(database, () => now);
    const taskPlans = new TaskPlanService(repository, () => new Date(now));
    taskPlans.create({ title: "今天整理", dueAt: "2026-08-18T03:00:00.000Z" });
    taskPlans.create({ title: "知识库想法", type: "idea" });
    const skillService = {
      list: async () => [
        { enabled: true, stale: false },
        { enabled: false, stale: false },
      ],
    } as unknown as SkillService;
    const dashboard = new DashboardService(taskPlans, skillService);
    const app = buildApp(undefined, undefined, undefined, dashboard);
    resources.push({ app, database });

    const response = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      plans: { pastPlanTime: 0, today: 1, inProgress: 0, blocked: 0 },
      skills: { total: 2, enabled: 1, stale: false },
      recentIdeas: [{ title: "知识库想法", type: "idea" }],
    });
  });
});
