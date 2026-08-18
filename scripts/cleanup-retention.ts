import { loadServerConfig } from "../src/server/config";
import { openDatabase } from "../src/server/db/connection";
import { migrateDatabase } from "../src/server/db/migrate";
import { cleanupRetention } from "../src/server/maintenance/retention";

const config = loadServerConfig();
const database = openDatabase(config.databasePath);
try {
  migrateDatabase(database);
  const result = cleanupRetention(database);
  process.stdout.write(JSON.stringify({ ok: true, ...result }) + "\n");
} finally {
  database.close();
}
