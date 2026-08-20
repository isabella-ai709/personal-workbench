import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Delete20Regular,
  Edit20Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type {
  CreateTaskPlanInput,
  TaskPlan,
  TaskPlanStatus,
} from "../../shared/task-plan-contracts";
import { getFocusGroup, type FocusGroup } from "../../shared/task-plan-groups";
import {
  ApiClientError,
  createTaskPlan,
  deleteTaskPlan,
  getTaskPlans,
  restoreTaskPlan,
  setTaskPlanStatus,
  updateTaskPlan,
} from "../api/client";
import { TaskPlanForm } from "../features/task-plans/task-plan-form";
import { TaskPlanList, type TaskPlanSection } from "../features/task-plans/task-plan-list";

type TaskPlanView = "focus" | "all" | "ideas" | "completed" | "deleted";
type TaskPlanFilter =
  | "all"
  | "type:todo"
  | "type:plan"
  | "type:idea"
  | "status:pending"
  | "status:in_progress"
  | "status:blocked"
  | "status:cancelled"
  | "priority:high"
  | "priority:medium"
  | "priority:low";

const viewCopy: Record<TaskPlanView, string> = {
  focus: "聚焦",
  all: "全部",
  ideas: "想法",
  completed: "已完成",
  deleted: "最近删除",
};
const typeCopy = { todo: "待办", plan: "计划", idea: "想法" } as const;
const statusCopy = {
  pending: "待处理",
  in_progress: "进行中",
  blocked: "等待/受阻",
  completed: "已完成",
  cancelled: "已取消",
} as const;
const priorityCopy = { low: "低", medium: "中", high: "高" } as const;
const groupCopy: Record<FocusGroup, string> = {
  past_plan_time: "计划时间已过",
  today: "今天处理",
  blocked: "等待/受阻",
  next_seven_days: "未来 7 天",
  later: "以后处理或未排期",
};
const groupOrder: FocusGroup[] = ["past_plan_time", "today", "blocked", "next_seven_days", "later"];
const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function compareItems(left: TaskPlan, right: TaskPlan): number {
  const priority = priorityRank[left.priority] - priorityRank[right.priority];
  if (priority !== 0) return priority;
  if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
  if (left.dueAt) return -1;
  if (right.dueAt) return 1;
  return right.updatedAt.localeCompare(left.updatedAt);
}

function formatDate(value: string | null): string {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TaskPlansPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<TaskPlanView>("focus");
  const [filter, setFilter] = useState<TaskPlanFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TaskPlan>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskPlan | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string>();

  const query = useQuery({
    queryKey: ["task-plans"],
    queryFn: () => getTaskPlans(true),
    retry: false,
  });
  const operation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onMutate: () => setError(undefined),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
    onError: (reason) =>
      setError(reason instanceof ApiClientError ? reason.message : "操作失败，请稍后再试。"),
  });

  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (query.data ?? []).filter((item) => {
      const matchesSearch =
        !normalized ||
        [item.title, item.nextAction, item.notes].some((value) =>
          value.toLocaleLowerCase().includes(normalized),
        );
      if (!matchesSearch) return false;
      if (filter !== "all") {
        const [field, value] = filter.split(":") as ["type" | "status" | "priority", string];
        if (item[field] !== value) return false;
      }
      if (view === "deleted") return Boolean(item.deletedAt);
      if (item.deletedAt) return false;
      if (view === "completed") return item.status === "completed";
      if (["completed", "cancelled"].includes(item.status)) return false;
      if (view === "ideas") return item.type === "idea";
      if (view === "focus") return getFocusGroup(item) !== null;
      return true;
    });
  }, [filter, query.data, search, view]);

  const sections = useMemo<TaskPlanSection[]>(() => {
    if (view === "focus") {
      const hasImmediateItems = visibleItems.some((item) => getFocusGroup(item) !== "later");
      return groupOrder.map((group) => ({
        key: group,
        label: groupCopy[group],
        collapsed: group === "later" && hasImmediateItems,
        items: visibleItems.filter((item) => getFocusGroup(item) === group).sort(compareItems),
      }));
    }
    return [
      {
        key: view,
        label: viewCopy[view],
        items: [...visibleItems].sort(compareItems),
      },
    ];
  }, [view, visibleItems]);

  useEffect(() => {
    if (selected && visibleItems.some((item) => item.id === selected.id)) {
      const refreshed = visibleItems.find((item) => item.id === selected.id);
      if (refreshed && refreshed !== selected) setSelected(refreshed);
      return;
    }
    setSelected(visibleItems[0]);
  }, [selected, visibleItems]);

  const save = (input: CreateTaskPlanInput) => {
    operation.mutate(async () => {
      const result = editing
        ? await updateTaskPlan(editing.id, input)
        : await createTaskPlan(input);
      setSelected(result);
      setFormOpen(false);
      setEditing(null);
    });
  };

  const changeStatus = (item: TaskPlan, status: TaskPlanStatus) => {
    if (item.status === status) return;
    operation.mutate(async () => {
      const result = await setTaskPlanStatus(item.id, status);
      setSelected(result);
    });
  };

  return (
    <div className="page-frame">
      <header className="page-heading task-plan-page-heading">
        <div>
          <h1>任务计划</h1>
          <p>把待办、计划和想法放在一起，需要行动的事项会自动进入聚焦列表。</p>
        </div>
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          记录新事项
        </Button>
      </header>

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="task-plan-toolbar">
        <div className="task-plan-views" role="tablist" aria-label="任务计划视图">
          {(Object.keys(viewCopy) as TaskPlanView[]).map((item) => (
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
        <div className="task-plan-search-tools">
          <Input
            contentBefore={<Search20Regular />}
            value={search}
            placeholder="搜索标题、下一步行动或备注"
            aria-label="搜索任务计划"
            onChange={(_, data) => setSearch(data.value)}
          />
          <select
            aria-label="筛选任务计划"
            value={filter}
            onChange={(event) => setFilter(event.target.value as TaskPlanFilter)}
          >
            <option value="all">全部条件</option>
            <optgroup label="类型">
              <option value="type:todo">待办</option>
              <option value="type:plan">计划</option>
              <option value="type:idea">想法</option>
            </optgroup>
            <optgroup label="状态">
              <option value="status:pending">待处理</option>
              <option value="status:in_progress">进行中</option>
              <option value="status:blocked">等待/受阻</option>
              <option value="status:cancelled">已取消</option>
            </optgroup>
            <optgroup label="优先级">
              <option value="priority:high">高优先级</option>
              <option value="priority:medium">中优先级</option>
              <option value="priority:low">低优先级</option>
            </optgroup>
          </select>
        </div>
      </div>

      {query.isPending ? (
        <div className="page-loading">
          <Spinner label="正在读取任务计划" />
        </div>
      ) : query.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>任务计划读取失败。</MessageBarBody>
        </MessageBar>
      ) : (
        <div className="task-plan-workspace">
          <section className="task-plan-list-panel" aria-label="任务计划列表">
            <TaskPlanList
              sections={sections}
              selectedId={selected?.id}
              busy={operation.isPending}
              onSelect={setSelected}
              onStatusChange={changeStatus}
            />
          </section>
          <section className="task-plan-detail-panel" aria-label="事项详情">
            {selected ? (
              <>
                <div className="task-plan-detail-heading">
                  <div>
                    <span className="task-plan-eyebrow">
                      {typeCopy[selected.type]} · {statusCopy[selected.status]}
                    </span>
                    <h2>{selected.title}</h2>
                  </div>
                  <Badge
                    appearance="tint"
                    color={selected.priority === "high" ? "danger" : "subtle"}
                  >
                    {priorityCopy[selected.priority]}优先级
                  </Badge>
                </div>

                <dl className="task-plan-metadata">
                  <div>
                    <dt>计划时间</dt>
                    <dd>{formatDate(selected.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>最近更新</dt>
                    <dd>{formatDate(selected.updatedAt)}</dd>
                  </div>
                </dl>

                <section className="task-plan-detail-section" data-accent="true">
                  <h3>下一步行动</h3>
                  <p>{selected.nextAction || "还没有填写下一步行动。"}</p>
                </section>
                <section className="task-plan-detail-section">
                  <h3>备注</h3>
                  <p>{selected.notes || "暂无备注。"}</p>
                </section>

                <div className="task-plan-detail-actions">
                  {selected.deletedAt ? (
                    <Button
                      disabled={operation.isPending}
                      onClick={() => operation.mutate(() => restoreTaskPlan(selected.id))}
                    >
                      恢复事项
                    </Button>
                  ) : (
                    <>
                      {["completed", "cancelled"].includes(selected.status) ? (
                        <Button onClick={() => changeStatus(selected, "pending")}>
                          恢复为待处理
                        </Button>
                      ) : (
                        <>
                          {selected.status !== "in_progress" ? (
                            <Button onClick={() => changeStatus(selected, "in_progress")}>
                              开始处理
                            </Button>
                          ) : null}
                          {selected.status !== "blocked" ? (
                            <Button onClick={() => changeStatus(selected, "blocked")}>
                              等待/受阻
                            </Button>
                          ) : null}
                          <Button
                            appearance="primary"
                            onClick={() => changeStatus(selected, "completed")}
                          >
                            标记完成
                          </Button>
                        </>
                      )}
                      <Button
                        appearance="subtle"
                        icon={<Edit20Regular />}
                        onClick={() => {
                          setEditing(selected);
                          setFormOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        onClick={() => setDeleteOpen(true)}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">选择一个事项查看详情。</div>
            )}
          </section>
        </div>
      )}

      <TaskPlanForm
        open={formOpen}
        taskPlan={editing}
        busy={operation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />

      <Dialog open={deleteOpen} onOpenChange={(_, data) => setDeleteOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除事项</DialogTitle>
            <DialogContent>事项会进入“最近删除”，之后仍可恢复。</DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteOpen(false)}>取消</Button>
              <Button
                appearance="primary"
                disabled={!selected || operation.isPending}
                onClick={() =>
                  selected &&
                  operation.mutate(async () => {
                    await deleteTaskPlan(selected.id);
                    setDeleteOpen(false);
                  })
                }
              >
                确认删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
