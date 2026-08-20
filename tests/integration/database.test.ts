import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";

const temporaryDirectories: string[] = [];
let database: WorkbenchDatabase | undefined;

afterEach(async () => {
  database?.close();
  database = undefined;
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
      ),
  );
});

describe("database migrations", () => {
  it("applies the schema once and enables foreign keys", async () => {
    const directory = await mkdtemp(join(tmpdir(), "workbench-db-test-"));
    temporaryDirectories.push(directory);
    database = openDatabase(join(directory, "workbench.sqlite"));

    expect(migrateDatabase(database)).toEqual([
      "001_initial.sql",
      "002_skill_cache.sql",
      "003_business_workbench.sql",
      "004_retrospectives.sql",
      "005_task_plans.sql",
      "006_ai_news_reports.sql",
    ]);
    expect(migrateDatabase(database)).toEqual([]);
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "schema_migrations",
        "task_plans",
        "skill_origin_overrides",
        "settings",
        "skill_cache",
        "business_companies",
        "business_contacts",
        "business_opportunities",
        "business_partnerships",
        "business_activities",
        "business_follow_ups",
        "business_events",
        "business_ai_drafts",
        "retrospectives",
        "ai_news_reports",
      ]),
    );
    expect(tables.map((table) => table.name)).not.toEqual(
      expect.arrayContaining(["tasks", "task_runs"]),
    );
    expect(database.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  });
});
