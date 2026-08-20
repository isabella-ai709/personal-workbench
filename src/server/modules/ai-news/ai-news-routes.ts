import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AiNewsService } from "./ai-news-service";

const reportParams = z.object({ reportId: z.string().trim().min(1).max(200) });

export function registerAiNewsRoutes(app: FastifyInstance, service: AiNewsService): void {
  app.put("/api/integrations/ai-news/reports/:reportId", async (request) => {
    const { reportId } = reportParams.parse(request.params);
    const detail = service.ingest(reportId, request.body);
    return {
      reportId: detail.reportId,
      status: "published" as const,
      importedAt: detail.importedAt,
    };
  });

  app.get("/api/ai-news/reports", async () => ({ items: service.list() }));
  app.get("/api/ai-news/reports/latest", async () => ({ item: service.latest() }));
  app.get("/api/ai-news/reports/:reportId", async (request) =>
    service.get(reportParams.parse(request.params).reportId),
  );
}
