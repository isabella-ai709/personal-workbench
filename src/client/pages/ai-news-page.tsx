import {
  Button,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getAiNewsReport, getAiNewsReports, getLatestAiNewsReport } from "../api/ai-news-client";
import { WeeklyReportReader } from "../features/ai-news/weekly-report-reader";

const staleAfterMs = 8 * 24 * 60 * 60 * 1_000;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AiNewsPage() {
  const [selectedId, setSelectedId] = useState("");
  const reports = useQuery({
    queryKey: ["ai-news-reports"],
    queryFn: getAiNewsReports,
    retry: false,
  });
  const report = useQuery({
    queryKey: ["ai-news-report", selectedId || "latest"],
    queryFn: () => (selectedId ? getAiNewsReport(selectedId) : getLatestAiNewsReport()),
    retry: false,
  });

  const refresh = async () => {
    await Promise.all([reports.refetch(), report.refetch()]);
  };

  if (report.isPending) {
    return (
      <div className="page-frame ai-news-loading" aria-label="正在加载 AI 新闻资讯">
        <Skeleton>
          <SkeletonItem size={40} />
        </Skeleton>
        <Skeleton>
          <SkeletonItem style={{ height: 44 }} />
        </Skeleton>
        <Skeleton>
          <SkeletonItem style={{ height: 520 }} />
        </Skeleton>
      </div>
    );
  }

  if (report.isError) {
    return (
      <div className="page-frame">
        <header className="page-heading">
          <h1>AI新闻资讯</h1>
        </header>
        <MessageBar intent="error">
          <MessageBarBody>AI 周报暂时无法读取，请确认工作台服务已启动。</MessageBarBody>
        </MessageBar>
        <Button
          icon={<ArrowClockwise20Regular />}
          onClick={() => void refresh()}
          style={{ marginTop: 16 }}
        >
          重新加载
        </Button>
      </div>
    );
  }

  const detail = report.data;
  return (
    <div className="page-frame ai-news-page">
      <header className="page-heading ai-news-page-heading">
        <div>
          <h1>AI新闻资讯</h1>
          <p>追踪 AI 前沿动态，沉淀每周个人情报。</p>
        </div>
        <div className="ai-news-actions">
          <label>
            <span className="sr-only">选择周报</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">最新一期</option>
              {reports.data?.map((item) => (
                <option value={item.reportId} key={item.reportId}>
                  {item.year}年第{item.week}周
                </option>
              ))}
            </select>
          </label>
          <Button icon={<ArrowClockwise20Regular />} onClick={() => void refresh()}>
            刷新数据
          </Button>
        </div>
      </header>

      {!detail ? (
        <div className="ai-news-empty">
          <h2>还没有 AI 周报</h2>
          <p>周报自动化首次成功推送后，会在这里显示完整内容。</p>
        </div>
      ) : (
        <>
          {Date.now() - new Date(detail.importedAt).getTime() > staleAfterMs ? (
            <MessageBar intent="warning">
              <MessageBarBody>最新周报已超过 8 天未更新，请检查每周自动化任务。</MessageBarBody>
            </MessageBar>
          ) : null}
          <section className="ai-news-status" aria-label="自动化运行状态">
            <strong>本周周报已同步</strong>
            <span>{formatDateTime(detail.importedAt)}</span>
            <span>耗时 {detail.durationSeconds.toFixed(1)} 秒</span>
            <span>来源异常 {detail.failedSources}</span>
            <span className="ai-news-status-stats">
              <b>收录 {detail.report.stats.report_event_count}</b> · 处理 {detail.articleCount} ·
              来源 {detail.sourceCount}
            </span>
          </section>
          <WeeklyReportReader report={detail.report} />
        </>
      )}
    </div>
  );
}
