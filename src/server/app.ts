import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { toApiError, WorkbenchError } from "../shared/errors";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard-routes";
import type { DashboardService } from "./modules/dashboard/dashboard-service";
import { registerSkillRoutes } from "./modules/skills/skill-routes";
import type { SkillService } from "./modules/skills/skill-service";
import { registerTaskRoutes } from "./modules/tasks/task-routes";
import type { TaskService } from "./modules/tasks/task-service";
import type { LocalSession } from "./security/local-session";

export function buildApp(
  taskService: TaskService,
  skillService?: SkillService,
  localSession?: LocalSession,
  dashboardService?: DashboardService,
): FastifyInstance {
  const app = Fastify({ logger: false });
  localSession?.register(app);
  registerTaskRoutes(app, taskService);
  if (skillService) registerSkillRoutes(app, skillService);
  if (dashboardService) registerDashboardRoutes(app, dashboardService);
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
