import {
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, ArrowRight20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getDashboard } from "../api/client";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
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
      <header className="dashboard-welcome">
        <div className="dashboard-welcome-copy">
          <span className="dashboard-welcome-kicker">Isabella.Y 工作台</span>
          <h1>
            <span className="sr-only">首页</span>
            <span aria-hidden="true">今天，从最重要的一件事开始。</span>
          </h1>
          <p>先看需要关注的个人事项，再进入具体模块继续处理。</p>
          <Button
            appearance="primary"
            icon={<ArrowRight20Regular />}
            iconPosition="after"
            onClick={() => navigate("/tasks")}
          >
            打开任务计划
          </Button>
        </div>
        <div className="dashboard-welcome-art" aria-hidden="true">
          <img src="/isabella-avatar.jpg" alt="" />
        </div>
      </header>

      {data.skills.stale ? (
        <MessageBar intent="warning" style={{ marginBottom: 20 }}>
          <MessageBarBody>
            Codex Skill 服务暂时不可用，当前显示上次缓存，写操作已停用。
          </MessageBarBody>
        </MessageBar>
      ) : null}

      <section className="metric-grid" aria-label="个人任务概览">
        <button className="metric-item metric-button" onClick={() => navigate("/tasks")}>
          <span className="metric-label">计划时间已过</span>
          <strong className="metric-value">{data.plans.pastPlanTime}</strong>
          <span className="metric-detail">优先确认是否继续或重新排期</span>
        </button>
        <button className="metric-item metric-button" onClick={() => navigate("/tasks")}>
          <span className="metric-label">今天处理</span>
          <strong className="metric-value">{data.plans.today}</strong>
          <span className="metric-detail">今天计划推进的事项</span>
        </button>
        <button className="metric-item metric-button" onClick={() => navigate("/tasks")}>
          <span className="metric-label">进行中</span>
          <strong className="metric-value">{data.plans.inProgress}</strong>
          <span className="metric-detail">已经开始处理</span>
        </button>
        <button className="metric-item metric-button" onClick={() => navigate("/tasks")}>
          <span className="metric-label">等待/受阻</span>
          <strong className="metric-value">{data.plans.blocked}</strong>
          <span className="metric-detail">等待信息、回复或其他条件</span>
        </button>
      </section>

      <section className="dashboard-section" aria-labelledby="recent-ideas-heading">
        <div className="section-heading-row">
          <h2 id="recent-ideas-heading">最近想法</h2>
          <Button
            appearance="subtle"
            icon={<ArrowRight20Regular />}
            iconPosition="after"
            onClick={() => navigate("/tasks")}
          >
            查看任务计划
          </Button>
        </div>
        {data.recentIdeas.length === 0 ? (
          <div className="empty-state">还没有记录想法。想到什么时，先记下来再决定是否执行。</div>
        ) : (
          <ul className="idea-list">
            {data.recentIdeas.map((idea) => (
              <li key={idea.id}>
                <div>
                  <strong>{idea.title}</strong>
                  <span>{idea.nextAction || "尚未决定下一步"}</span>
                </div>
                <time dateTime={idea.createdAt}>{formatDate(idea.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
