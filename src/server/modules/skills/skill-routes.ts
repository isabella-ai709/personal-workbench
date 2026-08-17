import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { SkillService } from "./skill-service";

const paramsSchema = z.object({ skillId: z.string().length(64) });
const originBodySchema = z.object({ origin: z.enum(["generated", "installed", "unconfirmed"]) });

export function registerSkillRoutes(app: FastifyInstance, service: SkillService): void {
  app.get("/api/skills", async () => ({ items: await service.list() }));
  app.get("/api/skills/:skillId", async (request) => {
    return service.get(paramsSchema.parse(request.params).skillId);
  });
  app.post("/api/skills/:skillId/enable", async (request) => {
    return service.setEnabled(paramsSchema.parse(request.params).skillId, true);
  });
  app.post("/api/skills/:skillId/disable", async (request) => {
    return service.setEnabled(paramsSchema.parse(request.params).skillId, false);
  });
  app.patch("/api/skills/:skillId/origin", async (request) => {
    return service.setOrigin(
      paramsSchema.parse(request.params).skillId,
      originBodySchema.parse(request.body).origin,
    );
  });
  app.post("/api/skills/:skillId/open-folder", async (request, reply) => {
    await service.openFolder(paramsSchema.parse(request.params).skillId);
    return reply.code(204).send();
  });
  app.delete("/api/skills/:skillId", async (request, reply) => {
    await service.delete(paramsSchema.parse(request.params).skillId);
    return reply.code(204).send();
  });
}
