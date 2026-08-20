import type { NotificationSeverity } from "../../../shared/notification-contracts";
import type { BusinessService } from "../business/business-service";
import type { TaskPlanService } from "../task-plans/task-plan-service";
import type { NotificationRepository } from "./notification-repository";

const partnershipNextStatuses = {
  idea: ["contacting", "paused"],
  contacting: ["proposal_confirmed", "paused"],
  proposal_confirmed: ["executing", "paused"],
  executing: ["completed", "paused"],
  completed: [],
  terminated: [],
  paused: ["contacting", "proposal_confirmed", "executing"],
} as const;

function calendarDay(value: string | Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000;
}

export function reminderSeverity(
  dueAt: string,
  now: Date,
  thresholdDays: number,
): NotificationSeverity | null {
  const difference = calendarDay(dueAt) - calendarDay(now);
  if (difference > thresholdDays) return null;
  return difference <= 0 ? "urgent" : "important";
}

function dueBody(dueAt: string, subject: string): string {
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dueAt));
  return `${subject}计划于 ${formatted} 截止，请确认是推进、延期、更改还是终止。`;
}

export class NotificationScanner {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly taskPlans: TaskPlanService,
    private readonly business: BusinessService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  scan(): void {
    const now = this.now();
    const occurredAt = now.toISOString();
    this.repository.restoreDueSnoozed(occurredAt);

    const taskPlans = this.taskPlans.list();
    const taskIds = new Set(taskPlans.map((item) => item.id));
    for (const item of taskPlans) {
      const active = !["completed", "cancelled"].includes(item.status) && item.dueAt;
      const severity = active ? reminderSeverity(item.dueAt!, now, 3) : null;
      if (!active || !severity) {
        this.repository.resolveSource("task_plans", "task_plan", item.id);
        continue;
      }
      this.repository.resolveSource("task_plans", "task_plan", item.id, item.dueAt!);
      this.repository.publish({
        sourceModule: "task_plans",
        sourceType: "task_plan",
        sourceId: item.id,
        eventType: "deadline",
        sourceVersion: item.dueAt!,
        title:
          severity === "urgent" ? `任务即将截止：${item.title}` : `任务计划提醒：${item.title}`,
        body: dueBody(item.dueAt!, "该任务"),
        severity,
        occurredAt,
        dueAt: item.dueAt,
        metadata: { href: "/tasks", sourceLabel: "任务计划" },
      });
    }
    this.repository.resolveMissingSources("task_plans", "task_plan", taskIds);

    const partnerships = this.business.listPartnerships();
    const partnershipIds = new Set(partnerships.map((item) => item.id));
    for (const item of partnerships) {
      const active = !["completed", "terminated"].includes(item.status) && item.targetEndAt;
      const severity = active ? reminderSeverity(item.targetEndAt!, now, 7) : null;
      if (!active || !severity) {
        this.repository.resolveSource("business", "partnership", item.id);
        continue;
      }
      this.repository.resolveSource("business", "partnership", item.id, item.targetEndAt!);
      this.repository.publish({
        sourceModule: "business",
        sourceType: "partnership",
        sourceId: item.id,
        eventType: "deadline",
        sourceVersion: item.targetEndAt!,
        title: severity === "urgent" ? `合作即将截止：${item.name}` : `商务合作提醒：${item.name}`,
        body: dueBody(item.targetEndAt!, "该合作"),
        severity,
        occurredAt,
        dueAt: item.targetEndAt,
        metadata: {
          href: "/business",
          sourceLabel: "商务合作",
          allowedNext: partnershipNextStatuses[item.status].join(","),
        },
      });
    }
    this.repository.resolveMissingSources("business", "partnership", partnershipIds);

    const followUps = this.business.listFollowUps();
    const followUpIds = new Set(followUps.map((item) => item.id));
    for (const item of followUps) {
      const active = item.status === "pending";
      const severity = active ? reminderSeverity(item.dueAt, now, 7) : null;
      if (!active || !severity) {
        this.repository.resolveSource("business", "follow_up", item.id);
        continue;
      }
      this.repository.resolveSource("business", "follow_up", item.id, item.dueAt);
      this.repository.publish({
        sourceModule: "business",
        sourceType: "follow_up",
        sourceId: item.id,
        eventType: "deadline",
        sourceVersion: item.dueAt,
        title:
          severity === "urgent" ? `跟进即将截止：${item.title}` : `商务跟进提醒：${item.title}`,
        body: dueBody(item.dueAt, "该跟进"),
        severity,
        occurredAt,
        dueAt: item.dueAt,
        metadata: { href: "/business", sourceLabel: "商务跟进" },
      });
    }
    this.repository.resolveMissingSources("business", "follow_up", followUpIds);
  }
}
