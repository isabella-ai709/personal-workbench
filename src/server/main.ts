import { buildApp } from "./app";
import { loadServerConfig, serverOrigin } from "./config";
import { openDatabase } from "./db/connection";
import { migrateDatabase } from "./db/migrate";
import { CodexTaskExecutor } from "./integrations/codex/codex-task-executor";
import { CodexSkillGateway } from "./integrations/codex/skill-gateway";
import { WindowsFolderOpener, WindowsRecycleBin } from "./integrations/windows-shell";
import { SkillCacheRepository } from "./modules/skills/skill-cache-repository";
import { SkillOriginRepository } from "./modules/skills/skill-origin-repository";
import { SkillService } from "./modules/skills/skill-service";
import { TaskRepository } from "./modules/tasks/task-repository";
import { TaskScheduler } from "./modules/tasks/task-scheduler";
import { TaskService } from "./modules/tasks/task-service";
import { LocalSession } from "./security/local-session";

const config = loadServerConfig();
const database = openDatabase(config.databasePath);
migrateDatabase(database);
const repository = new TaskRepository(database);
const executor = new CodexTaskExecutor({
  workingDirectory: config.workingDirectory,
  logsDirectory: config.logsDirectory,
});
const scheduler = new TaskScheduler(repository, executor);
const service = new TaskService(repository, scheduler, undefined, undefined, config.logsDirectory);
const skillService = new SkillService(
  new CodexSkillGateway({ cwd: config.workingDirectory }),
  new SkillOriginRepository(database),
  new SkillCacheRepository(database),
  new WindowsFolderOpener(),
  new WindowsRecycleBin(),
);
const app = buildApp(service, skillService, new LocalSession({ origin: serverOrigin(config) }));

const shutdown = async () => {
  await scheduler.stop();
  await app.close();
  database.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

scheduler.start();
await app.listen({ host: config.host, port: config.port });
process.stdout.write(`Personal Workbench API listening on http://${config.host}:${config.port}\n`);
