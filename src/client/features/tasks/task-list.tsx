import { Badge, Button } from "@fluentui/react-components";
import { Pause20Regular, Play20Regular } from "@fluentui/react-icons";

import type { Task } from "../../../shared/contracts";

interface TaskListProps {
  tasks: Task[];
  selectedId?: string;
  busy: boolean;
  onSelect: (task: Task) => void;
  onToggle: (task: Task) => void;
}

export function TaskList({ tasks, selectedId, busy, onSelect, onToggle }: TaskListProps) {
  if (tasks.length === 0) return <div className="empty-state">没有符合条件的任务。</div>;
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            className="task-list-select"
            data-selected={selectedId === task.id}
            onClick={() => onSelect(task)}
          >
            <span className="task-list-name">{task.name}</span>
            <span className="task-list-meta">
              {task.schedule.cron}，{task.schedule.timezone}
            </span>
            <span className="task-list-status">
              {task.deletedAt ? (
                <Badge appearance="tint" color="subtle">
                  已删除
                </Badge>
              ) : (
                <Badge appearance="tint" color={task.enabled ? "success" : "subtle"}>
                  {task.enabled ? "已启用" : "已暂停"}
                </Badge>
              )}
            </span>
          </button>
          {!task.deletedAt ? (
            <Button
              className="task-row-toggle"
              appearance="subtle"
              size="small"
              aria-label={task.enabled ? `暂停 ${task.name}` : `启用 ${task.name}`}
              icon={task.enabled ? <Pause20Regular /> : <Play20Regular />}
              disabled={busy}
              onClick={() => onToggle(task)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
