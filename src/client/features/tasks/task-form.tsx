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
  Textarea,
} from "@fluentui/react-components";
import { useEffect, useState, type FormEvent } from "react";

import type { CreateTaskInput, Task } from "../../../shared/contracts";

interface TaskFormProps {
  open: boolean;
  task?: Task | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput) => void;
}

const initialInput: CreateTaskInput = {
  name: "",
  prompt: "",
  schedule: { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
  enabled: true,
};

export function TaskForm({ open, task, busy, onClose, onSubmit }: TaskFormProps) {
  const [input, setInput] = useState<CreateTaskInput>(initialInput);
  useEffect(() => {
    if (!open) return;
    setInput(
      task
        ? { name: task.name, prompt: task.prompt, schedule: task.schedule, enabled: task.enabled }
        : initialInput,
    );
  }, [open, task]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(input);
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <form onSubmit={submit}>
          <DialogBody>
            <DialogTitle>{task ? "修改任务" : "创建任务"}</DialogTitle>
            <DialogContent className="task-form-fields">
              <Field label="任务名称" required>
                <Input
                  value={input.name}
                  maxLength={120}
                  onChange={(_, data) => setInput({ ...input, name: data.value })}
                />
              </Field>
              <Field label="执行说明" hint="Codex 将按这段说明完成任务" required>
                <Textarea
                  value={input.prompt}
                  resize="vertical"
                  rows={7}
                  maxLength={20_000}
                  onChange={(_, data) => setInput({ ...input, prompt: data.value })}
                />
              </Field>
              <div className="task-form-schedule">
                <Field label="Cron 表达式" required>
                  <Input
                    value={input.schedule.cron}
                    onChange={(_, data) =>
                      setInput({ ...input, schedule: { ...input.schedule, cron: data.value } })
                    }
                  />
                </Field>
                <Field label="时区" required>
                  <Input
                    value={input.schedule.timezone}
                    onChange={(_, data) =>
                      setInput({ ...input, schedule: { ...input.schedule, timezone: data.value } })
                    }
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={busy}>
                取消
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={busy || !input.name.trim() || !input.prompt.trim()}
              >
                {busy ? "正在保存" : "保存"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
