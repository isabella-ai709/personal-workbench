import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { TaskPlanRepository } from "../../src/server/modules/task-plans/task-plan-repository";
import { TaskPlanService } from "../../src/server/modules/task-plans/task-plan-service";

const resources: Array<{ app: ReturnType<typeof buildApp>; database: WorkbenchDatabase }> = [];
const now = "2026-08-18T01:00:00.000Z";

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.app.close();
    resource.database.close();
  }
});

function setup() {
  const database = openDatabase(":memory:");
  migrateDatabase(database);
  const service = new TaskPlanService(
    new TaskPlanRepository(database, () => now),
    () => new Date(now),
  );
  const app = buildApp(service);
  resources.push({ app, database });
  return app;
}

describe("task plan routes", () => {
  it("supports the complete personal task plan lifecycle", async () => {
    const app = setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/task-plans",
      payload: { title: "规划个人知识库", type: "plan", nextAction: "整理目录" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: "pending", priority: "medium" });
    const id = created.json().id as string;

    const started = await app.inject({
      method: "POST",
      url: `/api/task-plans/${id}/status`,
      payload: { status: "in_progress" },
    });
    expect(started.json().status).toBe("in_progress");

    const completed = await app.inject({
      method: "PATCH",
      url: `/api/task-plans/${id}`,
      payload: { status: "completed", notes: "完成初版" },
    });
    expect(completed.json()).toMatchObject({ completedAt: now, notes: "完成初版" });

    const cancelled = await app.inject({
      method: "POST",
      url: `/api/task-plans/${id}/status`,
      payload: { status: "cancelled" },
    });
    expect(cancelled.json()).toMatchObject({ status: "cancelled", completedAt: null });

    expect(
      (await app.inject({ method: "DELETE", url: `/api/task-plans/${id}` })).json().deletedAt,
    ).toBe(now);
    expect((await app.inject({ method: "GET", url: "/api/task-plans" })).json().items).toHaveLength(
      0,
    );
    expect(
      (await app.inject({ method: "GET", url: "/api/task-plans?includeDeleted=true" })).json()
        .items,
    ).toHaveLength(1);
    expect(
      (await app.inject({ method: "POST", url: `/api/task-plans/${id}/restore` })).json().deletedAt,
    ).toBeNull();
  });

  it("returns a stable validation error for invalid input", async () => {
    const response = await setup().inject({
      method: "POST",
      url: "/api/task-plans",
      payload: { title: "", type: "unknown" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
