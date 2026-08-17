import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { DashboardService } from "../../src/server/modules/dashboard/dashboard-service";
import type { SkillService } from "../../src/server/modules/skills/skill-service";
import { TaskRepository } from "../../src/server/modules/tasks/task-repository";
import type { TaskService } from "../../src/server/modules/tasks/task-service";

const resources: Array<{ app: ReturnType<typeof buildApp>; database: WorkbenchDatabase }> = [];

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.app.close();
    resource.database.close();
  }
});

describe("dashboard routes", () => {
  it("returns aggregate counts and only the five most recent runs", async () => {
    const database = openDatabase(":memory:");
    migrateDatabase(database);
    const repository = new TaskRepository(database, () => "2026-08-17T08:00:00.000Z");
    const task = repository.createTask({
      id: "7ed05fe2-9767-4755-864d-8261508c9696",
      name: "晨间整理",
      prompt: "整理今天事项",
      schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      enabled: true,
    });
    repository.createRun({
      taskId: task.id,
      status: "failed",
      trigger: "manual",
      idempotencyKey: "dashboard-run-1",
    });
    const skillService = {
      list: async () => [
        { enabled: true, stale: false },
        { enabled: false, stale: false },
      ],
    } as unknown as SkillService;
    const dashboard = new DashboardService(repository, skillService);
    const app = buildApp({} as TaskService, undefined, undefined, dashboard);
    resources.push({ app, database });

    const response = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tasks: { total: 1, enabled: 1, paused: 0, failedRuns: 1 },
      skills: { total: 2, enabled: 1, stale: false },
      recentRuns: [{ taskName: "晨间整理", status: "failed" }],
    });
  });
});
