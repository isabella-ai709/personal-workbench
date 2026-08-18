import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { toApiError, WorkbenchError } from "../shared/errors";
import { registerBusinessRoutes } from "./modules/business/business-routes";
import type { BusinessService } from "./modules/business/business-service";
import type { BusinessAiService } from "./modules/business/business-ai";
import { registerRetrospectiveRoutes } from "./modules/retrospectives/retrospective-routes";
import type { RetrospectiveService } from "./modules/retrospectives/retrospective-service";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard-routes";
import type { DashboardService } from "./modules/dashboard/dashboard-service";
import { registerSkillRoutes } from "./modules/skills/skill-routes";
import type { SkillService } from "./modules/skills/skill-service";
import { registerTaskPlanRoutes } from "./modules/task-plans/task-plan-routes";
import type { TaskPlanService } from "./modules/task-plans/task-plan-service";
import type { LocalSession } from "./security/local-session";

export function buildApp(
  taskPlanService?: TaskPlanService,
  skillService?: SkillService,
  localSession?: LocalSession,
  dashboardService?: DashboardService,
  businessService?: BusinessService,
  businessAiService?: BusinessAiService,
  retrospectiveService?: RetrospectiveService,
): FastifyInstance {
  const app = Fastify({ logger: false });
  localSession?.register(app);
  if (taskPlanService) registerTaskPlanRoutes(app, taskPlanService);
  if (skillService) registerSkillRoutes(app, skillService);
  if (dashboardService) registerDashboardRoutes(app, dashboardService);
  if (businessService) registerBusinessRoutes(app, businessService, businessAiService);
  if (retrospectiveService) registerRetrospectiveRoutes(app, retrospectiveService);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: { issues: error.issues },
        },
      });
    }
    if (error instanceof WorkbenchError) {
      return reply.code(error.status).send(toApiError(error));
    }
    return reply.code(500).send(toApiError(error));
  });
  return app;
}
