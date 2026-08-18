import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createRetrospectiveInputSchema,
  updateRetrospectiveInputSchema,
} from "../../../shared/retrospective-contracts";
import type { RetrospectiveService } from "./retrospective-service";
import {
  UnconfiguredRetrospectiveAiService,
  type RetrospectiveAiService,
} from "./retrospective-ai";

const idParams = z.object({ id: z.string().uuid() });

export function registerRetrospectiveRoutes(
  app: FastifyInstance,
  service: RetrospectiveService,
  aiService: RetrospectiveAiService = new UnconfiguredRetrospectiveAiService(),
): void {
  app.get("/api/retrospectives", async () => ({ items: service.list() }));
  app.post("/api/retrospectives", async (request, reply) =>
    reply.code(201).send(service.create(createRetrospectiveInputSchema.parse(request.body))),
  );
  app.get("/api/retrospectives/:id", async (request) =>
    service.get(idParams.parse(request.params).id),
  );
  app.patch("/api/retrospectives/:id", async (request) =>
    service.update(
      idParams.parse(request.params).id,
      updateRetrospectiveInputSchema.parse(request.body),
    ),
  );
  app.delete("/api/retrospectives/:id", async (request) =>
    service.delete(idParams.parse(request.params).id),
  );
  app.post("/api/retrospectives/:id/ai-analysis", async (request) => {
    const retrospective = service.get(idParams.parse(request.params).id);
    return aiService.analyze(retrospective);
  });
}
