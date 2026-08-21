import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AiOpportunityService } from "./ai-opportunity-service";

const params = z.object({ reportId: z.string().trim().min(1).max(200) });
export function registerAiOpportunityRoutes(
  app: FastifyInstance,
  service: AiOpportunityService,
): void {
  app.put("/api/integrations/ai-opportunities/reports/:reportId", async (request) => {
    const detail = service.ingest(params.parse(request.params).reportId, request.body);
    return {
      reportId: detail.reportId,
      status: "published" as const,
      importedAt: detail.importedAt,
    };
  });
  app.get("/api/ai-opportunities/reports", async () => ({ items: service.list() }));
  app.get("/api/ai-opportunities/reports/latest", async () => ({ item: service.latest() }));
  app.get("/api/ai-opportunities/reports/:reportId", async (request) =>
    service.get(params.parse(request.params).reportId),
  );
}
