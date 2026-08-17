import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { TaskRepository } from "../../src/server/modules/tasks/task-repository";
import { TaskScheduler, type SchedulerClock } from "../../src/server/modules/tasks/task-scheduler";
import { TaskService } from "../../src/server/modules/tasks/task-service";

const now = "2026-08-17T10:00:00.000Z";
const clock: SchedulerClock = {
  now: () => new Date(now),
  setTimeout: () => 1,
  clearTimeout: () => undefined,
};

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
  const repository = new TaskRepository(database, () => now);
  const scheduler = new TaskScheduler(
    repository,
    {
      execute: async () => ({
        resultPreview: "completed",
        codexThreadId: "thread-route-test",
        logPath: null,
      }),
    },
    undefined,
    clock,
  );
  const service = new TaskService(repository, scheduler, undefined, () => new Date(now));
  const app = buildApp(service);
  resources.push({ app, database });
  return { app, repository };
}

async function createTask(app: ReturnType<typeof buildApp>, name = "Daily review") {
  const response = await app.inject({
    method: "POST",
    url: "/api/tasks",
    payload: {
      name,
      prompt: "Summarize the day",
      schedule: { cron: "0 21 * * *", timezone: "Asia/Shanghai" },
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string; enabled: boolean; deletedAt: string | null }>();
}

describe("task routes", () => {
  it("creates, edits, pauses, enables, deletes, and restores a task", async () => {
    const { app } = setup();
    const task = await createTask(app);
    expect(task.enabled).toBe(true);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}`,
      payload: { name: "Evening review" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().name).toBe("Evening review");

    expect(
      (await app.inject({ method: "POST", url: `/api/tasks/${task.id}/pause` })).json().enabled,
    ).toBe(false);
    expect(
      (await app.inject({ method: "POST", url: `/api/tasks/${task.id}/enable` })).json().enabled,
    ).toBe(true);

    const deleted = await app.inject({ method: "DELETE", url: `/api/tasks/${task.id}` });
    expect(deleted.json().deletedAt).toBe(now);
    const restored = await app.inject({ method: "POST", url: `/api/tasks/${task.id}/restore` });
    expect(restored.json()).toMatchObject({ deletedAt: null, enabled: false });
  });

  it("uses the idempotency key to avoid duplicate immediate runs", async () => {
    const { app, repository } = setup();
    const task = await createTask(app);

    const first = await app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/run`,
      headers: { "idempotency-key": "manual-run-0001" },
      payload: {},
    });
    expect(first.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/run`,
      headers: { "idempotency-key": "manual-run-0001" },
      payload: {},
    });

    expect(second.statusCode).toBe(202);
    expect(second.json().id).toBe(first.json().id);
    expect(repository.listRuns(task.id)).toHaveLength(1);
    expect(repository.listRuns(task.id)[0]).toMatchObject({
      status: "succeeded",
      resultPreview: "completed",
      codexThreadId: "thread-route-test",
    });

    const otherTask = await createTask(app, "Other task");
    const crossTask = await app.inject({
      method: "POST",
      url: `/api/tasks/${otherTask.id}/run`,
      headers: { "idempotency-key": "manual-run-0001" },
      payload: {},
    });
    expect(crossTask.statusCode).toBe(409);
    expect(crossTask.json()).toMatchObject({ error: { code: "CONFLICT" } });
  });

  it("returns paginated history and stable validation errors", async () => {
    const { app } = setup();
    const task = await createTask(app);
    await app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/run`,
      headers: { "idempotency-key": "manual-run-0002" },
      payload: {},
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const history = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.id}/runs?limit=1`,
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().items).toHaveLength(1);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/tasks",
      payload: { name: "", prompt: "", schedule: { cron: "bad", timezone: "bad" } },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed" },
    });

    const missingKey = await app.inject({
      method: "POST",
      url: `/api/tasks/${task.id}/run`,
      payload: {},
    });
    expect(missingKey.statusCode).toBe(400);
    expect(missingKey.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
