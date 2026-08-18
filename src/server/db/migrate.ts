import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { WorkbenchDatabase } from "./connection";

const defaultMigrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations",
);

export function migrateDatabase(
  database: WorkbenchDatabase,
  migrationsDirectory = defaultMigrationsDirectory,
): string[] {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    (
      database.prepare("SELECT version FROM schema_migrations").all() as Array<{
        version: string;
      }>
    ).map((row) => row.version),
  );
  const files = readdirSync(migrationsDirectory)
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDirectory, file), "utf8");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
      database.exec("COMMIT");
      newlyApplied.push(file);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  return newlyApplied;
}
