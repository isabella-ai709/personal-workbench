import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createTaskPlanInputSchema,
  taskPlanListQuerySchema,
  taskPlanStatusSchema,
  updateTaskPlanInputSchema,
} from "../../../shared/task-plan-contracts";
import type { TaskPlanService } from "./task-plan-service";

const idParamsSchema = z.object({ id: z.string().uuid() });

export function registerTaskPlanRoutes(app: FastifyInstance, service: TaskPlanService): void {
  app.get("/api/task-plans", async (request) => {
    const query = taskPlanListQuerySchema.parse(request.query);
    return { items: service.list(query.includeDeleted) };
  });

  app.post("/api/task-plans", async (request, reply) => {
    const result = service.create(createTaskPlanInputSchema.parse(request.body));
    return reply.code(201).send(result);
  });

  app.get("/api/task-plans/:id", async (request) =>
    service.get(idParamsSchema.parse(request.params).id),
  );

  app.patch("/api/task-plans/:id", async (request) =>
    service.update(
      idParamsSchema.parse(request.params).id,
      updateTaskPlanInputSchema.parse(request.body),
    ),
  );

  app.post("/api/task-plans/:id/status", async (request) => {
    const body = z.object({ status: taskPlanStatusSchema }).parse(request.body);
    return service.setStatus(idParamsSchema.parse(request.params).id, body.status);
  });

  app.delete("/api/task-plans/:id", async (request) =>
    service.delete(idParamsSchema.parse(request.params).id),
  );

  app.post("/api/task-plans/:id/restore", async (request) =>
    service.restore(idParamsSchema.parse(request.params).id),
  );
}
