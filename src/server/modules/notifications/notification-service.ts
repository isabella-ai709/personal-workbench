import type {
  NotificationAction,
  NotificationListQuery,
  PublishNotificationInput,
} from "../../../shared/notification-contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { PartnershipStatus } from "../../../shared/business-contracts";
import type { BusinessService } from "../business/business-service";
import type { TaskPlanService } from "../task-plans/task-plan-service";
import type { NotificationRepository } from "./notification-repository";
import type { NotificationScanner } from "./notification-scanner";

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly scanner: NotificationScanner | undefined,
    private readonly taskPlans: TaskPlanService | undefined,
    private readonly business: BusinessService | undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  publish(input: PublishNotificationInput) {
    return this.repository.publish(input);
  }

  list(query: NotificationListQuery) {
    this.scanner?.scan();
    return this.repository.list(query);
  }

  summary() {
    this.scanner?.scan();
    return this.repository.summary();
  }

  setStatus(id: string, status: "read" | "unread" | "resolved" | "ignored") {
    return this.repository.setStatus(id, status);
  }

  snooze(id: string, until: string) {
    if (new Date(until) <= this.now()) {
      throw new WorkbenchError("VALIDATION_ERROR", "稍后提醒时间必须晚于当前时间", 400);
    }
    return this.repository.snooze(id, until);
  }

  act(id: string, input: NotificationAction) {
    const notification = this.repository.get(id);
    if (["resolved", "ignored"].includes(notification.status)) return notification;

    if (notification.sourceType === "task_plan") {
      if (!this.taskPlans) throw new WorkbenchError("UNAVAILABLE", "任务计划服务不可用", 503);
      if (input.action === "advance")
        this.taskPlans.setStatus(notification.sourceId, "in_progress");
      if (input.action === "postpone") {
        if (!input.dueAt)
          throw new WorkbenchError("VALIDATION_ERROR", "延期必须提供新的截止时间", 400);
        this.taskPlans.update(notification.sourceId, { dueAt: input.dueAt });
      }
      if (input.action === "cancel") this.taskPlans.setStatus(notification.sourceId, "cancelled");
    } else if (notification.sourceType === "partnership") {
      if (!this.business) throw new WorkbenchError("UNAVAILABLE", "商务服务不可用", 503);
      if (input.action === "advance") {
        if (!input.targetStatus)
          throw new WorkbenchError("VALIDATION_ERROR", "推进合作必须选择目标状态", 400);
        this.business.changePartnershipStatus(
          notification.sourceId,
          input.targetStatus as PartnershipStatus,
          input.note,
        );
      }
      if (input.action === "postpone") {
        if (!input.dueAt)
          throw new WorkbenchError("VALIDATION_ERROR", "延期必须提供新的截止时间", 400);
        this.business.updatePartnership(notification.sourceId, { targetEndAt: input.dueAt });
      }
      if (input.action === "cancel") {
        if (!input.note)
          throw new WorkbenchError("VALIDATION_ERROR", "终止合作必须填写结果摘要", 400);
        this.business.changePartnershipStatus(notification.sourceId, "terminated", input.note);
      }
    } else if (notification.sourceType === "follow_up") {
      if (!this.business) throw new WorkbenchError("UNAVAILABLE", "商务服务不可用", 503);
      if (input.action === "advance") {
        this.business.changeFollowUpStatus(notification.sourceId, "completed", input.note);
      }
      if (input.action === "postpone") {
        if (!input.dueAt)
          throw new WorkbenchError("VALIDATION_ERROR", "改期必须提供新的截止时间", 400);
        this.business.rescheduleFollowUp(notification.sourceId, input.dueAt, input.note);
      }
      if (input.action === "cancel") {
        this.business.changeFollowUpStatus(notification.sourceId, "cancelled", input.note);
      }
    } else {
      throw new WorkbenchError("INVALID_STATE", "这类消息不支持快捷业务操作", 409);
    }

    return this.repository.setStatus(id, "resolved");
  }
}
