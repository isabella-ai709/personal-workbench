import {
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, ArrowRight20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import type { TaskRunStatus } from "../../shared/contracts";
import { getDashboard } from "../api/client";

const statusCopy: Record<TaskRunStatus, string> = {
  pending: "等待中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
  missed: "已错过",
};

function statusColor(
  status: TaskRunStatus,
): "success" | "danger" | "warning" | "informative" | "subtle" {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "running" || status === "pending") return "informative";
  if (status === "missed") return "warning";
  return "subtle";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, retry: false });

  if (query.isPending) {
    return (
      <div className="page-frame dashboard-skeleton" aria-label="正在加载首页">
        <Skeleton>
          <SkeletonItem size={40} />
        </Skeleton>
        <Skeleton>
          <SkeletonItem style={{ height: 126 }} />
        </Skeleton>
        <Skeleton>
          <SkeletonItem style={{ height: 260 }} />
        </Skeleton>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="page-frame">
        <div className="page-heading">
          <h1>首页</h1>
        </div>
        <MessageBar intent="error">
          <MessageBarBody>工作台数据暂时无法读取。请确认本机服务已启动。</MessageBarBody>
        </MessageBar>
        <Button
          style={{ marginTop: 16 }}
          icon={<ArrowClockwise20Regular />}
          onClick={() => void query.refetch()}
        >
          重新加载
        </Button>
      </div>
    );
  }

  const data = query.data;
  return (
    <div className="page-frame">
      <header className="page-heading">
        <h1>首页</h1>
        <p>查看任务运行和 Skill 状态。所有操作都只在这台电脑上进行。</p>
      </header>

      {data.skills.stale ? (
        <MessageBar intent="warning" style={{ marginBottom: 20 }}>
          <MessageBarBody>
            Codex Skill 服务暂时不可用，当前显示上次缓存，写操作已停用。
          </MessageBarBody>
        </MessageBar>
      ) : null}

      <section className="metric-grid" aria-label="工作台概况">
        <div className="metric-item">
          <div className="metric-label">任务总数</div>
          <div className="metric-value">{data.tasks.total}</div>
          <div className="metric-detail">未删除的工作台任务</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">正在运行计划</div>
          <div className="metric-value">{data.tasks.enabled}</div>
          <div className="metric-detail">另有 {data.tasks.paused} 个已暂停</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">失败运行</div>
          <div className="metric-value">{data.tasks.failedRuns}</div>
          <div className="metric-detail">保留在任务日志中复查</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">可用 Skill</div>
          <div className="metric-value">{data.skills.enabled}</div>
          <div className="metric-detail">共发现 {data.skills.total} 个</div>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="recent-runs-heading">
        <div className="section-heading-row">
          <h2 id="recent-runs-heading">最近运行</h2>
          <Button
            appearance="subtle"
            icon={<ArrowRight20Regular />}
            iconPosition="after"
            onClick={() => navigate("/tasks")}
          >
            查看任务日志
          </Button>
        </div>
        {data.recentRuns.length === 0 ? (
          <div className="empty-state">还没有运行记录。创建任务后，结果会显示在这里。</div>
        ) : (
          <ul className="run-list">
            {data.recentRuns.map((run) => (
              <li className="run-row" key={run.id}>
                <span className="run-name">{run.taskName}</span>
                <Badge appearance="tint" color={statusColor(run.status)}>
                  {statusCopy[run.status]}
                </Badge>
                <time className="run-time" dateTime={run.createdAt}>
                  {formatDate(run.createdAt)}
                </time>
                <span className="run-result">
                  {run.resultPreview ?? run.errorMessage ?? "暂无结果摘要"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
