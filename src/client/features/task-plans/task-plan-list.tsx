import { Badge, Button } from "@fluentui/react-components";
import { Checkmark20Regular } from "@fluentui/react-icons";

import type { TaskPlan, TaskPlanStatus } from "../../../shared/task-plan-contracts";
import type { FocusGroup } from "../../../shared/task-plan-groups";

export interface TaskPlanSection {
  key: FocusGroup | "all" | "ideas" | "completed" | "deleted";
  label: string;
  items: TaskPlan[];
  collapsed?: boolean;
}

interface TaskPlanListProps {
  sections: TaskPlanSection[];
  selectedId?: string;
  busy: boolean;
  onSelect: (item: TaskPlan) => void;
  onStatusChange: (item: TaskPlan, status: TaskPlanStatus) => void;
}

const typeCopy = { todo: "待办", plan: "计划", idea: "想法" } as const;
const priorityCopy = { low: "低", medium: "中", high: "高" } as const;
const statusCopy = {
  pending: "待处理",
  in_progress: "进行中",
  blocked: "等待/受阻",
  completed: "已完成",
} as const;

function formatDueAt(value: string | null): string {
  if (!value) return "未排期";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function TaskPlanRow({
  item,
  selected,
  busy,
  onSelect,
  onStatusChange,
}: {
  item: TaskPlan;
  selected: boolean;
  busy: boolean;
  onSelect: (item: TaskPlan) => void;
  onStatusChange: (item: TaskPlan, status: TaskPlanStatus) => void;
}) {
  return (
    <li className="task-plan-row" data-selected={selected}>
      <button className="task-plan-select" onClick={() => onSelect(item)}>
        <span className="task-plan-row-heading">
          <strong>{item.title}</strong>
          <Badge appearance="tint" color={item.priority === "high" ? "danger" : "subtle"}>
            {priorityCopy[item.priority]}
          </Badge>
        </span>
        <span className="task-plan-row-meta">
          {typeCopy[item.type]} · {formatDueAt(item.dueAt)}
        </span>
        <span className="task-plan-next-action">
          {item.nextAction ? `下一步：${item.nextAction}` : "还没有填写下一步行动"}
        </span>
      </button>
      {!item.deletedAt ? (
        <div className="task-plan-row-actions">
          <select
            aria-label={`更改 ${item.title} 的状态`}
            value={item.status}
            disabled={busy}
            onChange={(event) => onStatusChange(item, event.target.value as TaskPlanStatus)}
          >
            {Object.entries(statusCopy).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {item.status !== "completed" ? (
            <Button
              appearance="subtle"
              size="small"
              aria-label={`完成 ${item.title}`}
              icon={<Checkmark20Regular />}
              disabled={busy}
              onClick={() => onStatusChange(item, "completed")}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function TaskPlanList({
  sections,
  selectedId,
  busy,
  onSelect,
  onStatusChange,
}: TaskPlanListProps) {
  if (sections.every((section) => section.items.length === 0)) {
    return <div className="empty-state">这里还没有事项，可以先记录一条待办、计划或想法。</div>;
  }

  return (
    <div className="task-plan-sections">
      {sections.map((section) => {
        if (section.items.length === 0) return null;
        return (
          <details key={section.key} open={!section.collapsed} className="task-plan-section">
            <summary>
              <span>{section.label}</span>
              <span>{section.items.length}</span>
            </summary>
            <ul>
              {section.items.map((item) => (
                <TaskPlanRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  busy={busy}
                  onSelect={onSelect}
                  onStatusChange={onStatusChange}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
