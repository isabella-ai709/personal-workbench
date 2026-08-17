import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { toApiError, WorkbenchError } from "../shared/errors";
import { registerSkillRoutes } from "./modules/skills/skill-routes";
import type { SkillService } from "./modules/skills/skill-service";
import { registerTaskRoutes } from "./modules/tasks/task-routes";
import type { TaskService } from "./modules/tasks/task-service";

export function buildApp(taskService: TaskService, skillService?: SkillService): FastifyInstance {
  const app = Fastify({ logger: false });
  registerTaskRoutes(app, taskService);
  if (skillService) registerSkillRoutes(app, skillService);
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
