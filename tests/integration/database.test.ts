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

    expect(migrateDatabase(database)).toEqual(["001_initial.sql"]);
    expect(migrateDatabase(database)).toEqual([]);
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "schema_migrations",
        "tasks",
        "task_runs",
        "skill_origin_overrides",
        "settings",
      ]),
    );
    expect(database.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  });
});
