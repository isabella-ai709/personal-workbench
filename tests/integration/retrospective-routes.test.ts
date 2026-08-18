import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { RetrospectiveRepository } from "../../src/server/modules/retrospectives/retrospective-repository";
import { RetrospectiveService } from "../../src/server/modules/retrospectives/retrospective-service";
import { TaskRepository } from "../../src/server/modules/tasks/task-repository";
import { TaskScheduler } from "../../src/server/modules/tasks/task-scheduler";
import { TaskService } from "../../src/server/modules/tasks/task-service";

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
  let now = "2026-08-18T08:00:00.000Z";
  const taskRepository = new TaskRepository(database);
  const scheduler = new TaskScheduler(taskRepository, {
    execute: async () => ({ resultPreview: "", codexThreadId: null, logPath: null }),
  });
  const taskService = new TaskService(taskRepository, scheduler);
  const retrospectiveRepository = new RetrospectiveRepository(database, () => now);
  const app = buildApp(
    taskService,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    new RetrospectiveService(retrospectiveRepository),
  );
  resources.push({ app, database });
  return {
    app,
    setNow(value: string) {
      now = value;
    },
  };
}

describe("retrospective routes", () => {
  it("creates, lists by creation time, edits, and soft deletes records", async () => {
    const { app, setNow } = setup();
    const first = await app.inject({
      method: "POST",
      url: "/api/retrospectives",
      payload: { title: "第一次复盘", review: "事情经过" },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      title: "第一次复盘",
      review: "事情经过",
      didWell: "",
      deletedAt: null,
    });

    setNow("2026-08-18T09:00:00.000Z");
    const second = await app.inject({
      method: "POST",
      url: "/api/retrospectives",
      payload: { title: "第二次复盘", lesson: "先确认事实" },
    });
    expect(second.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/api/retrospectives" });
    expect(list.json().items.map((item: { title: string }) => item.title)).toEqual([
      "第二次复盘",
      "第一次复盘",
    ]);

    setNow("2026-08-18T10:00:00.000Z");
    const patched = await app.inject({
      method: "PATCH",
      url: `/api/retrospectives/${first.json().id}`,
      payload: { nextImprovement: "下次先列提纲" },
    });
    expect(patched.json()).toMatchObject({
      nextImprovement: "下次先列提纲",
      createdAt: "2026-08-18T08:00:00.000Z",
      updatedAt: "2026-08-18T10:00:00.000Z",
    });

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/retrospectives/${second.json().id}`,
    });
    expect(deleted.json().deletedAt).toBe("2026-08-18T10:00:00.000Z");
    const remaining = await app.inject({ method: "GET", url: "/api/retrospectives" });
    expect(remaining.json().items).toHaveLength(1);
  });

  it("returns stable validation and not-found errors", async () => {
    const { app } = setup();
    const invalid = await app.inject({
      method: "POST",
      url: "/api/retrospectives",
      payload: { title: "   " },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const badId = await app.inject({ method: "GET", url: "/api/retrospectives/not-a-uuid" });
    expect(badId.statusCode).toBe(400);

    const missing = await app.inject({
      method: "GET",
      url: "/api/retrospectives/123e4567-e89b-12d3-a456-426614174000",
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
