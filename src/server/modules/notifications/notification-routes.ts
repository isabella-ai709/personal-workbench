import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  notificationActionSchema,
  notificationListQuerySchema,
  notificationSnoozeSchema,
  notificationStatusUpdateSchema,
} from "../../../shared/notification-contracts";
import type { NotificationService } from "./notification-service";

const idParams = z.object({ id: z.string().uuid() });

export function registerNotificationRoutes(
  app: FastifyInstance,
  service: NotificationService,
): void {
  app.get("/api/notifications", async (request) =>
    service.list(notificationListQuerySchema.parse(request.query)),
  );
  app.get("/api/notifications/summary", async () => service.summary());
  app.patch("/api/notifications/:id/status", async (request) => {
    const { status } = notificationStatusUpdateSchema.parse(request.body);
    return service.setStatus(idParams.parse(request.params).id, status);
  });
  app.post("/api/notifications/:id/snooze", async (request) => {
    const { until } = notificationSnoozeSchema.parse(request.body);
    return service.snooze(idParams.parse(request.params).id, until);
  });
  app.post("/api/notifications/:id/actions", async (request) =>
    service.act(idParams.parse(request.params).id, notificationActionSchema.parse(request.body)),
  );
}
