import { buildApp } from "./app";
import { loadServerConfig, serverOrigin } from "./config";
import { openDatabase } from "./db/connection";
import { migrateDatabase } from "./db/migrate";
import { CodexTaskExecutor } from "./integrations/codex/codex-task-executor";
import { CodexSkillGateway } from "./integrations/codex/skill-gateway";
import { WindowsFolderOpener, WindowsRecycleBin } from "./integrations/windows-shell";
import { DashboardService } from "./modules/dashboard/dashboard-service";
import { BusinessRepository } from "./modules/business/business-repository";
import { BusinessService } from "./modules/business/business-service";
import { BusinessAiService, CodexBusinessAiExtractor } from "./modules/business/business-ai";
import { SkillCacheRepository } from "./modules/skills/skill-cache-repository";
import { SkillOriginRepository } from "./modules/skills/skill-origin-repository";
import { SkillService } from "./modules/skills/skill-service";
import { TaskRepository } from "./modules/tasks/task-repository";
import { TaskScheduler } from "./modules/tasks/task-scheduler";
import { TaskService } from "./modules/tasks/task-service";
import { LocalSession } from "./security/local-session";
import { cleanupRetention } from "./maintenance/retention";

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
const businessRepository = new BusinessRepository(database);
const skillService = new SkillService(
  new CodexSkillGateway({ cwd: config.workingDirectory }),
  new SkillOriginRepository(database),
  new SkillCacheRepository(database),
  new WindowsFolderOpener(),
  new WindowsRecycleBin(),
);
const app = buildApp(
  service,
  skillService,
  new LocalSession({ origin: serverOrigin(config) }),
  new DashboardService(repository, skillService),
  new BusinessService(businessRepository),
  new BusinessAiService(
    businessRepository,
    new CodexBusinessAiExtractor({ workingDirectory: config.workingDirectory }),
  ),
);

const shutdown = async () => {
  await scheduler.stop();
  await app.close();
  database.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

scheduler.start();
await app.listen({ host: config.host, port: config.port });
const retentionResult = cleanupRetention(database);
process.stdout.write(
  `Retention cleanup: ${retentionResult.deletedRuns} runs, ${retentionResult.deletedTasks} deleted tasks\n`,
);
const retentionTimer = setInterval(
  () => {
    try {
      cleanupRetention(database);
    } catch (error) {
      process.stderr.write(`Retention cleanup failed: ${String(error)}\n`);
    }
  },
  6 * 60 * 60 * 1000,
);
retentionTimer.unref();
process.stdout.write(`Personal Workbench API listening on http://${config.host}:${config.port}\n`);
