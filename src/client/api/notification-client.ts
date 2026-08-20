import {
  notificationListSchema,
  notificationSchema,
  notificationSummarySchema,
  type Notification,
  type NotificationAction,
  type NotificationList,
  type NotificationSourceModule,
  type NotificationSummary,
} from "../../shared/notification-contracts";
import { apiRequest } from "./client";

export type NotificationView = "all" | "unread" | "important" | "snoozed" | "resolved";

export async function getNotifications(
  view: NotificationView,
  source?: NotificationSourceModule,
  cursor?: string,
): Promise<NotificationList> {
  const params = new URLSearchParams({ view });
  if (source) params.set("source", source);
  if (cursor) params.set("cursor", cursor);
  return notificationListSchema.parse(await apiRequest(`/api/notifications?${params.toString()}`));
}

export async function getNotificationSummary(): Promise<NotificationSummary> {
  return notificationSummarySchema.parse(await apiRequest("/api/notifications/summary"));
}

export async function setNotificationStatus(
  id: string,
  status: "read" | "unread" | "resolved" | "ignored",
): Promise<Notification> {
  return notificationSchema.parse(
    await apiRequest(`/api/notifications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  );
}

export async function snoozeNotification(id: string, until: string): Promise<Notification> {
  return notificationSchema.parse(
    await apiRequest(`/api/notifications/${id}/snooze`, {
      method: "POST",
      body: JSON.stringify({ until }),
    }),
  );
}

export async function runNotificationAction(
  id: string,
  input: NotificationAction,
): Promise<Notification> {
  return notificationSchema.parse(
    await apiRequest(`/api/notifications/${id}/actions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
