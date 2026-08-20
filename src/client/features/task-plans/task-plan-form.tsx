import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@fluentui/react-components";
import { useEffect, useState, type FormEvent } from "react";

import type {
  CreateTaskPlanInput,
  TaskPlan,
  TaskPlanPriority,
  TaskPlanStatus,
  TaskPlanType,
} from "../../../shared/task-plan-contracts";

interface TaskPlanDraft {
  type: TaskPlanType;
  title: string;
  status: TaskPlanStatus;
  priority: TaskPlanPriority;
  dueAt: string;
  nextAction: string;
  notes: string;
}

interface TaskPlanFormProps {
  open: boolean;
  taskPlan?: TaskPlan | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTaskPlanInput) => void;
}

const emptyDraft: TaskPlanDraft = {
  type: "todo",
  title: "",
  status: "pending",
  priority: "medium",
  dueAt: "",
  nextAction: "",
  notes: "",
};

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function TaskPlanForm({ open, taskPlan, busy, onClose, onSubmit }: TaskPlanFormProps) {
  const [draft, setDraft] = useState<TaskPlanDraft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      taskPlan
        ? {
            type: taskPlan.type,
            title: taskPlan.title,
            status: taskPlan.status,
            priority: taskPlan.priority,
            dueAt: toLocalInput(taskPlan.dueAt),
            nextAction: taskPlan.nextAction,
            notes: taskPlan.notes,
          }
        : emptyDraft,
    );
  }, [open, taskPlan]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...draft,
      dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <form onSubmit={submit}>
          <DialogBody>
            <DialogTitle>{taskPlan ? "编辑事项" : "记录新事项"}</DialogTitle>
            <DialogContent className="task-plan-form">
              <div className="task-plan-form-row">
                <Field label="类型" required>
                  <Select
                    value={draft.type}
                    onChange={(_, data) => setDraft({ ...draft, type: data.value as TaskPlanType })}
                  >
                    <option value="todo">待办</option>
                    <option value="plan">计划</option>
                    <option value="idea">想法</option>
                  </Select>
                </Field>
                <Field label="状态" required>
                  <Select
                    value={draft.status}
                    onChange={(_, data) =>
                      setDraft({ ...draft, status: data.value as TaskPlanStatus })
                    }
                  >
                    <option value="pending">待处理</option>
                    <option value="in_progress">进行中</option>
                    <option value="blocked">等待/受阻</option>
                    <option value="completed">已完成</option>
                    <option value="cancelled">已取消</option>
                  </Select>
                </Field>
                <Field label="优先级" required>
                  <Select
                    value={draft.priority}
                    onChange={(_, data) =>
                      setDraft({ ...draft, priority: data.value as TaskPlanPriority })
                    }
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </Select>
                </Field>
              </div>
              <Field label="标题" required>
                <Input
                  value={draft.title}
                  maxLength={300}
                  placeholder="要做什么，或先记下什么想法？"
                  onChange={(_, data) => setDraft({ ...draft, title: data.value })}
                />
              </Field>
              <Field label="计划时间" hint="想法或尚未排期的事项可以留空">
                <input
                  className="task-plan-datetime"
                  aria-label="计划时间"
                  type="datetime-local"
                  value={draft.dueAt}
                  onInput={(event) => {
                    const dueAt = event.currentTarget.value;
                    setDraft((current) => ({ ...current, dueAt }));
                  }}
                  onChange={(event) => {
                    const dueAt = event.target.value;
                    setDraft((current) => ({ ...current, dueAt }));
                  }}
                />
              </Field>
              <Field label="下一步行动" hint="写下下一次打开这条事项时可以直接做的动作">
                <Textarea
                  value={draft.nextAction}
                  rows={3}
                  maxLength={2_000}
                  resize="vertical"
                  onChange={(_, data) => setDraft({ ...draft, nextAction: data.value })}
                />
              </Field>
              <Field label="备注">
                <Textarea
                  value={draft.notes}
                  rows={6}
                  maxLength={20_000}
                  resize="vertical"
                  onChange={(_, data) => setDraft({ ...draft, notes: data.value })}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={busy}>
                取消
              </Button>
              <Button appearance="primary" type="submit" disabled={busy || !draft.title.trim()}>
                {busy ? "正在保存" : "保存"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
