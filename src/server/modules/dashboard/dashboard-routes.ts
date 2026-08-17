import type { FastifyInstance } from "fastify";

import type { DashboardService } from "./dashboard-service";

export function registerDashboardRoutes(app: FastifyInstance, service: DashboardService): void {
  app.get("/api/dashboard", async () => service.getSummary());
}
