import {
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
  Select,
  Spinner,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Delete20Regular,
  Edit20Regular,
  Play20Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { CreateTaskInput, Task, TaskRun } from "../../shared/contracts";
import {
  ApiClientError,
  createTask,
  deleteTask,
  getTaskRuns,
  getTasks,
  restoreTask,
  runTask,
  setTaskEnabled,
  updateTask,
} from "../api/client";
import { RunDetail } from "../features/tasks/run-detail";
import { TaskForm } from "../features/tasks/task-form";
import { TaskList } from "../features/tasks/task-list";

type TaskFilter = "active" | "enabled" | "paused" | "deleted";

export function TasksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [selected, setSelected] = useState<Task>();
  const [selectedRun, setSelectedRun] = useState<TaskRun>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string>();

  const tasksQuery = useQuery({
    queryKey: ["tasks", filter === "deleted"],
    queryFn: () => getTasks(filter === "deleted"),
    retry: false,
  });
  const runsQuery = useQuery({
    queryKey: ["task-runs", selected?.id],
    queryFn: () => getTaskRuns(selected!.id),
    enabled: Boolean(selected?.id),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "pending" || run.status === "running")
        ? 2_000
        : false,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["task-runs"] }),
    ]);
  };
  const operation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onMutate: () => setError(undefined),
    onSuccess: () => void refresh(),
    onError: (reason) =>
      setError(reason instanceof ApiClientError ? reason.message : "操作失败，请稍后再试。"),
  });

  const tasks = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (tasksQuery.data ?? []).filter((task) => {
      const statusMatches =
        filter === "deleted"
          ? Boolean(task.deletedAt)
          : !task.deletedAt &&
            (filter === "active" ||
              (filter === "enabled" && task.enabled) ||
              (filter === "paused" && !task.enabled));
      return statusMatches && (!normalized || task.name.toLocaleLowerCase().includes(normalized));
    });
  }, [filter, search, tasksQuery.data]);

  useEffect(() => {
    if (selected && tasks.some((task) => task.id === selected.id)) {
      const refreshed = tasks.find((task) => task.id === selected.id);
      if (refreshed && refreshed !== selected) setSelected(refreshed);
      return;
    }
    setSelected(tasks[0]);
  }, [tasks, selected]);

  useEffect(() => {
    setSelectedRun(runsQuery.data?.[0]);
  }, [runsQuery.data, selected?.id]);

  const save = (input: CreateTaskInput) => {
    operation.mutate(async () => {
      const result = editing ? await updateTask(editing.id, input) : await createTask(input);
      setSelected(result);
      setFormOpen(false);
      setEditing(null);
    });
  };

  return (
    <div className="page-frame">
      <header className="page-heading task-page-heading">
        <div>
          <h1>任务日志</h1>
          <p>管理工作台自有任务，查看每次 Codex 运行的状态与结果。</p>
        </div>
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          创建任务
        </Button>
      </header>

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="task-toolbar" aria-label="任务筛选">
        <Input
          contentBefore={<Search20Regular />}
          value={search}
          placeholder="搜索任务名称"
          aria-label="搜索任务名称"
          onChange={(_, data) => setSearch(data.value)}
        />
        <Select
          aria-label="任务状态"
          value={filter}
          onChange={(_, data) => setFilter(data.value as TaskFilter)}
        >
          <option value="active">全部任务</option>
          <option value="enabled">已启用</option>
          <option value="paused">已暂停</option>
          <option value="deleted">最近删除</option>
        </Select>
      </div>

      {tasksQuery.isPending ? (
        <div className="page-loading">
          <Spinner label="正在读取任务" />
        </div>
      ) : tasksQuery.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>任务列表读取失败。</MessageBarBody>
        </MessageBar>
      ) : (
        <div className="task-workspace">
          <section className="task-list-panel" aria-label="任务列表">
            <TaskList
              tasks={tasks}
              selectedId={selected?.id}
              busy={operation.isPending}
              onSelect={setSelected}
              onToggle={(task) =>
                operation.mutate(async () => {
                  const result = await setTaskEnabled(task.id, !task.enabled);
                  setSelected(result);
                })
              }
            />
          </section>
          <section className="task-detail-panel" aria-label="任务详情">
            {selected ? (
              <>
                <div className="task-detail-header">
                  <div>
                    <h2>{selected.name}</h2>
                    <p>
                      {selected.schedule.cron}，{selected.schedule.timezone}
                    </p>
                  </div>
                  <div className="task-detail-actions">
                    {selected.deletedAt ? (
                      <Button
                        disabled={operation.isPending}
                        onClick={() => operation.mutate(() => restoreTask(selected.id))}
                      >
                        恢复任务
                      </Button>
                    ) : (
                      <>
                        <Button
                          icon={<Play20Regular />}
                          disabled={operation.isPending}
                          onClick={() => operation.mutate(() => runTask(selected.id))}
                        >
                          立即运行
                        </Button>
                        <Button
                          appearance="subtle"
                          icon={<Edit20Regular />}
                          onClick={() => {
                            setEditing(selected);
                            setFormOpen(true);
                          }}
                        >
                          修改
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
                </div>
                <div className="task-prompt">{selected.prompt}</div>

                {!selected.deletedAt ? (
                  <div className="run-workspace">
                    <div className="run-history" aria-label="运行记录">
                      <h3>运行记录</h3>
                      {runsQuery.isPending ? <Spinner size="tiny" label="正在读取" /> : null}
                      {runsQuery.data?.length === 0 ? (
                        <div className="empty-state">还没有运行记录。</div>
                      ) : null}
                      {runsQuery.data?.map((run) => (
                        <button
                          key={run.id}
                          data-selected={selectedRun?.id === run.id}
                          onClick={() => setSelectedRun(run)}
                        >
                          <strong>{run.status}</strong>
                          <span>{new Date(run.createdAt).toLocaleString("zh-CN")}</span>
                        </button>
                      ))}
                    </div>
                    <div className="run-result-panel">
                      {selectedRun ? (
                        <RunDetail
                          run={selectedRun}
                          busy={operation.isPending}
                          onRetry={(run) => operation.mutate(() => runTask(selected.id, run.id))}
                        />
                      ) : (
                        <div className="empty-state">选择一条运行记录查看结果。</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">选择一个任务查看详情。</div>
            )}
          </section>
        </div>
      )}

      <TaskForm
        open={formOpen}
        task={editing}
        busy={operation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />

      <Dialog open={deleteOpen} onOpenChange={(_, data) => setDeleteOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除任务</DialogTitle>
            <DialogContent>
              任务将停止运行并进入最近删除，保留 30 天。期间可以恢复，运行记录不会立即清除。
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteOpen(false)}>取消</Button>
              <Button
                appearance="primary"
                disabled={!selected || operation.isPending}
                onClick={() =>
                  selected &&
                  operation.mutate(async () => {
                    await deleteTask(selected.id);
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
