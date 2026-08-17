import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createTaskInputSchema,
  paginationQuerySchema,
  updateTaskInputSchema,
} from "../../../shared/contracts";
import type { TaskService } from "./task-service";

const idParamsSchema = z.object({ id: z.string().uuid() });
const runParamsSchema = z.object({ runId: z.string().uuid() });
const listQuerySchema = z.object({
  includeDeleted: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
const runNowBodySchema = z.object({ retriedFromRunId: z.string().uuid().optional() }).default({});
const idempotencyKeySchema = z.string().min(8).max(200);

export function registerTaskRoutes(app: FastifyInstance, service: TaskService): void {
  app.get("/api/tasks", async (request) => {
    const query = listQuerySchema.parse(request.query);
    return { items: service.list(query.includeDeleted) };
  });

  app.post("/api/tasks", async (request, reply) => {
    const task = service.create(createTaskInputSchema.parse(request.body));
    return reply.code(201).send(task);
  });

  app.get("/api/tasks/:id", async (request) => {
    return service.get(idParamsSchema.parse(request.params).id);
  });

  app.patch("/api/tasks/:id", async (request) => {
    return service.update(
      idParamsSchema.parse(request.params).id,
      updateTaskInputSchema.parse(request.body),
    );
  });

  app.post("/api/tasks/:id/enable", async (request) => {
    return service.enable(idParamsSchema.parse(request.params).id);
  });

  app.post("/api/tasks/:id/pause", async (request) => {
    return service.pause(idParamsSchema.parse(request.params).id);
  });

  app.post("/api/tasks/:id/run", async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = runNowBodySchema.parse(request.body ?? {});
    const header = request.headers["idempotency-key"];
    const idempotencyKey = idempotencyKeySchema.parse(header);
    const run = service.runNow(id, idempotencyKey, body.retriedFromRunId);
    return reply.code(202).send(run);
  });

  app.get("/api/tasks/:id/runs", async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return service.listRuns(id, paginationQuerySchema.parse(request.query));
  });

  app.get("/api/runs/:runId", async (request) => {
    return service.getRun(runParamsSchema.parse(request.params).runId);
  });

  app.get("/api/runs/:runId/log", async (request, reply) => {
    const log = await service.readRunLog(runParamsSchema.parse(request.params).runId);
    return reply.type("application/x-ndjson; charset=utf-8").send(log);
  });

  app.delete("/api/tasks/:id", async (request) => {
    return service.delete(idParamsSchema.parse(request.params).id);
  });

  app.post("/api/tasks/:id/restore", async (request) => {
    return service.restore(idParamsSchema.parse(request.params).id);
  });
}
