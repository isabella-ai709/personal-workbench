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
import { AiNewsRepository } from "./modules/ai-news/ai-news-repository";
import { AiNewsService } from "./modules/ai-news/ai-news-service";
import { NotificationRepository } from "./modules/notifications/notification-repository";
import { NotificationScanner } from "./modules/notifications/notification-scanner";
import { NotificationService } from "./modules/notifications/notification-service";
import { AiOpportunityRepository } from "./modules/ai-opportunities/ai-opportunity-repository";
import { AiOpportunityService } from "./modules/ai-opportunities/ai-opportunity-service";

const config = loadServerConfig();
const database = openDatabase(config.databasePath);
migrateDatabase(database);
const taskPlanService = new TaskPlanService(new TaskPlanRepository(database));
const businessRepository = new BusinessRepository(database);
const businessService = new BusinessService(businessRepository);
const notificationRepository = new NotificationRepository(database);
const notificationScanner = new NotificationScanner(
  notificationRepository,
  taskPlanService,
  businessService,
);
const notificationService = new NotificationService(
  notificationRepository,
  notificationScanner,
  taskPlanService,
  businessService,
);
const aiNewsService = new AiNewsService(new AiNewsRepository(database, notificationRepository));
const aiOpportunityService = new AiOpportunityService(
  new AiOpportunityRepository(database, notificationRepository),
);
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
  new LocalSession({ origin: serverOrigin(config), integrationToken: config.integrationToken }),
  new DashboardService(taskPlanService, skillService),
  businessService,
  new BusinessAiService(
    businessRepository,
    new CodexBusinessAiExtractor({ workingDirectory: config.workingDirectory }),
  ),
  new RetrospectiveService(new RetrospectiveRepository(database)),
  undefined,
  aiNewsService,
  notificationService,
  aiOpportunityService,
);

notificationScanner.scan();

const shutdown = async () => {
  await app.close();
  database.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
process.stdout.write(`Personal Workbench API listening on http://${config.host}:${config.port}\n`);
