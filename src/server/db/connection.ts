import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type WorkbenchDatabase = DatabaseSync;

export function openDatabase(filename: string): WorkbenchDatabase {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
  return database;
}
