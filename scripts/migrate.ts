import { resolve } from "node:path";

import { openDatabase } from "../src/server/db/connection";
import { migrateDatabase } from "../src/server/db/migrate";

const databasePath = process.env.WORKBENCH_DATABASE_PATH
  ? resolve(process.env.WORKBENCH_DATABASE_PATH)
  : resolve("data", "workbench.sqlite");
const database = openDatabase(databasePath);
try {
  const applied = migrateDatabase(database);
  process.stdout.write(
    `${applied.length > 0 ? `Applied migrations: ${applied.join(", ")}` : "Database is up to date"}\n`,
  );
} finally {
  database.close();
}
