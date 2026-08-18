import { buildApp } from "./app";
import { loadServerConfig, serverOrigin } from "./config";
import { openDatabase } from "./db/connection";
import { migrateDatabase } from "./db/migrate";
import { CodexSkillGateway } from "./integrations/codex/skill-gateway";
import { WindowsFolderOpener, WindowsRecycleBin } from "./integrations/windows-shell";
import { DashboardService } from "./modules/dashboard/dashboard-service";
import { BusinessRepository } from "./modules/business/business-repository";
import { BusinessService } from "./modules/business/business-service";
import { BusinessAiService, CodexBusinessAiExtractor } from "./modules/business/business-ai";
import { SkillCacheRepository } from "./modules/skills/skill-cache-repository";
import { SkillOriginRepository } from "./modules/skills/skill-origin-repository";
import { SkillService } from "./modules/skills/skill-service";
import { TaskPlanRepository } from "./modules/task-plans/task-plan-repository";
import { TaskPlanService } from "./modules/task-plans/task-plan-service";
import { LocalSession } from "./security/local-session";
import { RetrospectiveRepository } from "./modules/retrospectives/retrospective-repository";
import { RetrospectiveService } from "./modules/retrospectives/retrospective-service";

const config = loadServerConfig();
const database = openDatabase(config.databasePath);
migrateDatabase(database);
const taskPlanService = new TaskPlanService(new TaskPlanRepository(database));
const businessRepository = new BusinessRepository(database);
const skillService = new SkillService(
  new CodexSkillGateway({ cwd: config.workingDirectory }),
  new SkillOriginRepository(database),
  new SkillCacheRepository(database),
  new WindowsFolderOpener(),
  new WindowsRecycleBin(),
);
const app = buildApp(
  taskPlanService,
  skillService,
  new LocalSession({ origin: serverOrigin(config) }),
  new DashboardService(taskPlanService, skillService),
  new BusinessService(businessRepository),
  new BusinessAiService(
    businessRepository,
    new CodexBusinessAiExtractor({ workingDirectory: config.workingDirectory }),
  ),
  new RetrospectiveService(new RetrospectiveRepository(database)),
);

const shutdown = async () => {
  await app.close();
  database.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
process.stdout.write(`Personal Workbench API listening on http://${config.host}:${config.port}\n`);
