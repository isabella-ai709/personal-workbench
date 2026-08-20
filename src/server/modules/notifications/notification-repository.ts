import { randomUUID } from "node:crypto";

import type {
  Notification,
  NotificationList,
  NotificationListQuery,
  NotificationStatus,
  PublishNotificationInput,
} from "../../../shared/notification-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { WorkbenchDatabase } from "../../db/connection";

interface NotificationRow {
  id: string;
  source_module: Notification["sourceModule"];
  source_type: Notification["sourceType"];
  source_id: string;
  event_type: string;
  source_version: string;
  title: string;
  body: string;
  severity: Notification["severity"];
  status: NotificationStatus;
  occurred_at: string;
  due_at: string | null;
  snoozed_until: string | null;
  resolved_at: string | null;
  ignored_at: string | null;
  created_at: string;
  updated_at: string;
  delivery_channel: "in_app";
  metadata_json: string;
}

function mapNotification(row: NotificationRow): Notification {
  let metadata: Record<string, string> = {};
  try {
    const parsed = JSON.parse(row.metadata_json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadata = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      );
    }
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    sourceModule: row.source_module,
    sourceType: row.source_type,
    sourceId: row.source_id,
    eventType: row.event_type,
    sourceVersion: row.source_version,
    title: row.title,
    body: row.body,
    severity: row.severity,
    status: row.status,
    occurredAt: row.occurred_at,
    dueAt: row.due_at,
    snoozedUntil: row.snoozed_until,
    resolvedAt: row.resolved_at,
    ignoredAt: row.ignored_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveryChannel: row.delivery_channel,
    metadata,
  };
}

export class NotificationRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  get(id: string): Notification {
    const row = this.database.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as
      NotificationRow | undefined;
    if (!row) throw new WorkbenchError("NOT_FOUND", "消息不存在", 404);
    return mapNotification(row);
  }

  findBySource(input: PublishNotificationInput): Notification | null {
    const row = this.database
      .prepare(
        `SELECT * FROM notifications
         WHERE source_module = ? AND source_type = ? AND source_id = ?
           AND event_type = ? AND source_version = ?`,
      )
      .get(
        input.sourceModule,
        input.sourceType,
        input.sourceId,
        input.eventType,
        input.sourceVersion,
      ) as NotificationRow | undefined;
    return row ? mapNotification(row) : null;
  }

  publish(input: PublishNotificationInput): Notification {
    const timestamp = this.now();
    const current = this.findBySource(input);
    if (current && ["resolved", "ignored"].includes(current.status)) return current;
    const nextStatus =
      current?.status === "read" && input.severity === "urgent" && current.severity !== "urgent"
        ? "unread"
        : (current?.status ?? "unread");
    const nextOccurredAt =
      current && current.severity === input.severity ? current.occurredAt : input.occurredAt;
    const id = current?.id ?? randomUUID();
    this.database
      .prepare(
        `INSERT INTO notifications (
          id, source_module, source_type, source_id, event_type, source_version,
          title, body, severity, status, occurred_at, due_at, snoozed_until,
          resolved_at, ignored_at, created_at, updated_at, delivery_channel, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 'in_app', ?)
        ON CONFLICT(source_module, source_type, source_id, event_type, source_version)
        DO UPDATE SET title = excluded.title, body = excluded.body,
          severity = excluded.severity, status = excluded.status,
          occurred_at = excluded.occurred_at, due_at = excluded.due_at,
          updated_at = excluded.updated_at, metadata_json = excluded.metadata_json`,
      )
      .run(
        id,
        input.sourceModule,
        input.sourceType,
        input.sourceId,
        input.eventType,
        input.sourceVersion,
        input.title,
        input.body,
        input.severity,
        nextStatus,
        nextOccurredAt,
        input.dueAt ?? null,
        current?.createdAt ?? timestamp,
        timestamp,
        JSON.stringify(input.metadata ?? {}),
      );
    return this.get(id);
  }

  list(query: NotificationListQuery): NotificationList {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (query.view === "unread") clauses.push("status = 'unread'");
    if (query.view === "important") {
      clauses.push("status = 'unread'");
      clauses.push("severity IN ('important', 'urgent')");
    }
    if (query.view === "snoozed") clauses.push("status = 'snoozed'");
    if (query.view === "resolved") clauses.push("status IN ('resolved', 'ignored')");
    if (query.source) {
      clauses.push("source_module = ?");
      params.push(query.source);
    }
    const offset = query.cursor ?? 0;
    const rows = this.database
      .prepare(
        `SELECT * FROM notifications
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY CASE severity WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
                  occurred_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit + 1, offset) as unknown as NotificationRow[];
    const hasMore = rows.length > query.limit;
    return {
      items: rows.slice(0, query.limit).map(mapNotification),
      nextCursor: hasMore ? String(offset + query.limit) : null,
    };
  }

  summary(): { importantUnread: number; totalUnread: number } {
    const row = this.database
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'unread' AND severity IN ('important', 'urgent') THEN 1 ELSE 0 END) AS important_unread,
          SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) AS total_unread
         FROM notifications`,
      )
      .get() as { important_unread: number | null; total_unread: number | null };
    return {
      importantUnread: Number(row.important_unread ?? 0),
      totalUnread: Number(row.total_unread ?? 0),
    };
  }

  setStatus(
    id: string,
    status: Extract<NotificationStatus, "read" | "unread" | "resolved" | "ignored">,
  ): Notification {
    const current = this.get(id);
    if (current.status === status) return current;
    const timestamp = this.now();
    this.database
      .prepare(
        `UPDATE notifications SET status = ?, snoozed_until = NULL,
          resolved_at = ?, ignored_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        status,
        status === "resolved" ? timestamp : null,
        status === "ignored" ? timestamp : null,
        timestamp,
        id,
      );
    return this.get(id);
  }

  snooze(id: string, until: string): Notification {
    this.get(id);
    this.database
      .prepare(
        `UPDATE notifications SET status = 'snoozed', snoozed_until = ?,
          resolved_at = NULL, ignored_at = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(until, this.now(), id);
    return this.get(id);
  }

  restoreDueSnoozed(now: string): void {
    this.database
      .prepare(
        `UPDATE notifications SET status = 'unread', snoozed_until = NULL, updated_at = ?
         WHERE status = 'snoozed' AND snoozed_until <= ?`,
      )
      .run(now, now);
  }

  resolveSource(
    sourceModule: Notification["sourceModule"],
    sourceType: Notification["sourceType"],
    sourceId: string,
    exceptVersion?: string,
  ): void {
    const timestamp = this.now();
    this.database
      .prepare(
        `UPDATE notifications SET status = 'resolved', resolved_at = ?, updated_at = ?
         WHERE source_module = ? AND source_type = ? AND source_id = ?
           AND status NOT IN ('resolved', 'ignored')
           AND (? IS NULL OR source_version <> ?)`,
      )
      .run(
        timestamp,
        timestamp,
        sourceModule,
        sourceType,
        sourceId,
        exceptVersion ?? null,
        exceptVersion ?? null,
      );
  }

  resolveMissingSources(
    sourceModule: Notification["sourceModule"],
    sourceType: Notification["sourceType"],
    existingIds: ReadonlySet<string>,
  ): void {
    const rows = this.database
      .prepare(
        `SELECT DISTINCT source_id FROM notifications
         WHERE source_module = ? AND source_type = ? AND status NOT IN ('resolved', 'ignored')`,
      )
      .all(sourceModule, sourceType) as Array<{ source_id: string }>;
    for (const row of rows) {
      if (!existingIds.has(row.source_id))
        this.resolveSource(sourceModule, sourceType, row.source_id);
    }
  }
}
