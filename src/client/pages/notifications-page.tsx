import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  Checkmark20Regular,
  ClockAlarm20Regular,
  Dismiss20Regular,
  Open20Regular,
} from "@fluentui/react-icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type {
  Notification,
  NotificationAction,
  NotificationSourceModule,
} from "../../shared/notification-contracts";
import {
  getNotifications,
  runNotificationAction,
  setNotificationStatus,
  snoozeNotification,
  type NotificationView,
} from "../api/notification-client";

const viewCopy: Record<NotificationView, string> = {
  all: "全部",
  unread: "未读",
  important: "重要",
  snoozed: "稍后提醒",
  resolved: "已处理",
};
const sourceCopy: Record<NotificationSourceModule, string> = {
  task_plans: "任务计划",
  business: "商务合作",
  ai_news: "AI 新闻资讯",
  ai_opportunities: "小D机会",
};
const severityCopy = { normal: "普通", important: "重要", urgent: "紧急" } as const;
const partnershipStatusCopy: Record<string, string> = {
  idea: "构想",
  contacting: "接洽中",
  proposal_confirmed: "方案已确认",
  executing: "执行中",
  completed: "已完成",
  paused: "已暂停",
};

type TimedAction = { kind: "snooze" | "postpone"; notification: Notification };

function formatDateTime(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toLocalInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<NotificationView>("unread");
  const [source, setSource] = useState<NotificationSourceModule | "">("");
  const [error, setError] = useState<string>();
  const [timedAction, setTimedAction] = useState<TimedAction>();
  const [actionTime, setActionTime] = useState("");
  const [partnershipTargets, setPartnershipTargets] = useState<Record<string, string>>({});

  const query = useInfiniteQuery({
    queryKey: ["notifications", view, source],
    initialPageParam: "",
    queryFn: ({ pageParam }) => getNotifications(view, source || undefined, pageParam || undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const operation = useMutation({
    mutationFn: async (
      input:
        | { type: "status"; id: string; status: "read" | "unread" | "resolved" | "ignored" }
        | { type: "snooze"; id: string; until: string }
        | { type: "action"; id: string; action: NotificationAction },
    ) => {
      if (input.type === "status") return setNotificationStatus(input.id, input.status);
      if (input.type === "snooze") return snoozeNotification(input.id, input.until);
      return runNotificationAction(input.id, input.action);
    },
    onMutate: () => setError(undefined),
    onSuccess: async () => {
      setTimedAction(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notification-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["task-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["business"] }),
      ]);
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "操作失败，请重试。"),
  });

  const openTimedAction = (kind: TimedAction["kind"], notification: Notification) => {
    const initial = new Date();
    if (kind === "snooze") {
      initial.setDate(initial.getDate() + 1);
      initial.setHours(9, 0, 0, 0);
    } else {
      initial.setDate(initial.getDate() + (notification.sourceType === "task_plan" ? 3 : 7));
    }
    setActionTime(toLocalInput(initial));
    setTimedAction({ kind, notification });
  };

  const viewDetails = (notification: Notification) => {
    if (notification.status === "unread") {
      operation.mutate({ type: "status", id: notification.id, status: "read" });
    }
    navigate(notification.metadata.href || "/");
  };

  const cancel = (notification: Notification) => {
    const label = notification.sourceType === "partnership" ? "终止合作" : "取消事项";
    if (!window.confirm(`确认${label}“${notification.title.replace(/^.*：/, "")}”吗？`)) return;
    let note = "";
    if (notification.sourceType === "partnership") {
      note = window.prompt("请填写终止合作的结果摘要：")?.trim() ?? "";
      if (!note) return;
    }
    operation.mutate({
      type: "action",
      id: notification.id,
      action: { action: "cancel", note },
    });
  };

  const advance = (notification: Notification) => {
    const targetStatus =
      notification.sourceType === "partnership"
        ? partnershipTargets[notification.id] || notification.metadata.allowedNext?.split(",")[0]
        : undefined;
    operation.mutate({
      type: "action",
      id: notification.id,
      action: {
        action: "advance",
        targetStatus: targetStatus as NotificationAction["targetStatus"],
        note: "",
      },
    });
  };

  return (
    <div className="page-frame notifications-page">
      <header className="page-heading notifications-heading">
        <div>
          <h1>消息提醒</h1>
          <p>集中查看工作台结果通知与需要决策的临期事项。</p>
        </div>
        <Button icon={<ArrowClockwise20Regular />} onClick={() => void query.refetch()}>
          刷新
        </Button>
      </header>

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="notifications-toolbar">
        <div className="notifications-tabs" role="tablist" aria-label="消息状态筛选">
          {(Object.keys(viewCopy) as NotificationView[]).map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={view === item}
              onClick={() => setView(item)}
            >
              {viewCopy[item]}
            </button>
          ))}
        </div>
        <select
          aria-label="消息来源筛选"
          value={source}
          onChange={(event) => setSource(event.target.value as NotificationSourceModule | "")}
        >
          <option value="">全部来源</option>
          {(Object.keys(sourceCopy) as NotificationSourceModule[]).map((item) => (
            <option key={item} value={item}>
              {sourceCopy[item]}
            </option>
          ))}
        </select>
      </div>

      {query.isPending ? (
        <div className="page-loading">
          <Spinner label="正在读取消息" />
        </div>
      ) : query.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>消息中心暂时无法读取。</MessageBarBody>
        </MessageBar>
      ) : items.length === 0 ? (
        <div className="notifications-empty">
          <Checkmark20Regular />
          <h2>当前没有需要关注的消息</h2>
          <p>新的结果通知和临期事项会自动整理到这里。</p>
        </div>
      ) : (
        <section className="notification-list" aria-label="消息列表">
          {items.map((notification) => {
            const allowedNext = (notification.metadata.allowedNext ?? "")
              .split(",")
              .filter(Boolean);
            const actionable = notification.eventType === "deadline";
            return (
              <article
                key={notification.id}
                className="notification-card"
                data-severity={notification.severity}
                data-unread={notification.status === "unread"}
              >
                <div className="notification-card-main">
                  <div className="notification-card-meta">
                    <Badge
                      appearance="tint"
                      color={
                        notification.severity === "urgent"
                          ? "danger"
                          : notification.severity === "important"
                            ? "warning"
                            : "informative"
                      }
                    >
                      {severityCopy[notification.severity]}
                    </Badge>
                    <span>
                      {notification.metadata.sourceLabel || sourceCopy[notification.sourceModule]}
                    </span>
                    <span>{formatDateTime(notification.occurredAt)}</span>
                  </div>
                  <h2>{notification.title}</h2>
                  <p>{notification.body}</p>
                  {notification.dueAt ? (
                    <time>截止：{formatDateTime(notification.dueAt)}</time>
                  ) : null}
                </div>
                <div className="notification-card-actions">
                  <Button
                    size="small"
                    icon={<Open20Regular />}
                    onClick={() => viewDetails(notification)}
                  >
                    查看详情
                  </Button>
                  {notification.status === "unread" ? (
                    <Button
                      size="small"
                      onClick={() =>
                        operation.mutate({ type: "status", id: notification.id, status: "read" })
                      }
                    >
                      标记已读
                    </Button>
                  ) : notification.status === "read" ? (
                    <Button
                      size="small"
                      onClick={() =>
                        operation.mutate({ type: "status", id: notification.id, status: "unread" })
                      }
                    >
                      设为未读
                    </Button>
                  ) : null}
                  {!(["resolved", "ignored"] as string[]).includes(notification.status) ? (
                    <>
                      <Button
                        size="small"
                        icon={<ClockAlarm20Regular />}
                        onClick={() => openTimedAction("snooze", notification)}
                      >
                        稍后提醒
                      </Button>
                      {actionable ? (
                        <>
                          {notification.sourceType === "partnership" && allowedNext.length ? (
                            <select
                              aria-label={`选择 ${notification.title} 的推进状态`}
                              value={partnershipTargets[notification.id] || allowedNext[0]}
                              onChange={(event) =>
                                setPartnershipTargets((current) => ({
                                  ...current,
                                  [notification.id]: event.target.value,
                                }))
                              }
                            >
                              {allowedNext.map((status) => (
                                <option key={status} value={status}>
                                  {partnershipStatusCopy[status] ?? status}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <Button
                            size="small"
                            appearance="primary"
                            onClick={() => advance(notification)}
                          >
                            {notification.sourceType === "follow_up" ? "完成跟进" : "推进"}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => openTimedAction("postpone", notification)}
                          >
                            延期
                          </Button>
                          <Button
                            size="small"
                            icon={<Dismiss20Regular />}
                            onClick={() => cancel(notification)}
                          >
                            {notification.sourceType === "partnership" ? "终止" : "取消"}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={() => {
                          if (window.confirm("忽略后，本次提醒不会再次出现。确认忽略吗？"))
                            operation.mutate({
                              type: "status",
                              id: notification.id,
                              status: "ignored",
                            });
                        }}
                      >
                        忽略
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
          {query.hasNextPage ? (
            <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {query.isFetchingNextPage ? "加载中…" : "加载更多"}
            </Button>
          ) : null}
        </section>
      )}

      <Dialog
        open={Boolean(timedAction)}
        onOpenChange={(_, data) => !data.open && setTimedAction(undefined)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{timedAction?.kind === "snooze" ? "稍后提醒" : "延期"}</DialogTitle>
            <DialogContent>
              <label className="notification-time-field">
                <span>{timedAction?.kind === "snooze" ? "再次提醒时间" : "新的截止时间"}</span>
                <input
                  type="datetime-local"
                  value={actionTime}
                  onChange={(event) => setActionTime(event.target.value)}
                />
              </label>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setTimedAction(undefined)}>
                取消
              </Button>
              <Button
                appearance="primary"
                disabled={!actionTime || operation.isPending}
                onClick={() => {
                  if (!timedAction || !actionTime) return;
                  const until = new Date(actionTime).toISOString();
                  operation.mutate(
                    timedAction.kind === "snooze"
                      ? { type: "snooze", id: timedAction.notification.id, until }
                      : {
                          type: "action",
                          id: timedAction.notification.id,
                          action: { action: "postpone", dueAt: until, note: "从消息中心调整时间" },
                        },
                  );
                }}
              >
                确认
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
