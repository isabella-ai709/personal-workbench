// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as aiNewsClient from "../../src/client/api/ai-news-client";
import { AiNewsPage } from "../../src/client/pages/ai-news-page";
import type { AiNewsReportDetail } from "../../src/shared/ai-news-contracts";
import { aiNewsIngestFixture } from "../fixtures/ai-news-report";

vi.mock("../../src/client/api/ai-news-client", () => ({
  getAiNewsReports: vi.fn(),
  getLatestAiNewsReport: vi.fn(),
  getAiNewsReport: vi.fn(),
}));

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    MessageBar: Box,
    MessageBarBody: Box,
    Skeleton: Box,
    SkeletonItem: () => <div />,
  };
});

function detail(importedAt = "2026-08-19T06:03:00.000Z"): AiNewsReportDetail {
  const input = aiNewsIngestFixture();
  return {
    reportId: input.report.report_id,
    schemaVersion: 1,
    title: input.report.title,
    year: input.report.year,
    week: input.report.week,
    startDate: input.report.start_date,
    endDate: input.report.end_date,
    createdAt: input.report.created_at,
    importedAt,
    articleCount: input.report.article_count,
    sourceCount: input.report.source_count,
    durationSeconds: input.report.stats.duration_seconds,
    failedSources: input.report.stats.failed_sources,
    report: input.report,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AiNewsPage />
    </QueryClientProvider>,
  );
}

describe("AI news page", () => {
  it("renders the latest complete weekly report", async () => {
    const current = detail(new Date().toISOString());
    vi.mocked(aiNewsClient.getAiNewsReports).mockResolvedValue([current]);
    vi.mocked(aiNewsClient.getLatestAiNewsReport).mockResolvedValue(current);
    renderPage();

    expect(screen.getByLabelText("正在加载 AI 新闻资讯")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "AI新闻资讯" })).toBeInTheDocument();
    expect(screen.getByText("GPT-5.6 构建指南")).toBeInTheDocument();
    expect(screen.getByText("为什么重要")).toBeInTheDocument();
    expect(screen.getAllByText(/收录 15/).length).toBeGreaterThan(0);
  });

  it("shows an empty state before the first successful push", async () => {
    vi.mocked(aiNewsClient.getAiNewsReports).mockResolvedValue([]);
    vi.mocked(aiNewsClient.getLatestAiNewsReport).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText("还没有 AI 周报")).toBeInTheDocument();
  });

  it("warns when the latest report is older than eight days", async () => {
    const old = detail("2026-07-01T00:00:00.000Z");
    vi.mocked(aiNewsClient.getAiNewsReports).mockResolvedValue([old]);
    vi.mocked(aiNewsClient.getLatestAiNewsReport).mockResolvedValue(old);
    renderPage();
    expect(await screen.findByText(/超过 8 天未更新/)).toBeInTheDocument();
  });

  it("switches to a selected historical issue", async () => {
    const current = detail(new Date().toISOString());
    const historical = detail(new Date().toISOString());
    historical.reportId = "ai-weekly-2026-W33";
    historical.week = 33;
    historical.report = {
      ...historical.report,
      report_id: historical.reportId,
      week: 33,
      title: "第33周周报",
    };
    vi.mocked(aiNewsClient.getAiNewsReports).mockResolvedValue([current, historical]);
    vi.mocked(aiNewsClient.getLatestAiNewsReport).mockResolvedValue(current);
    vi.mocked(aiNewsClient.getAiNewsReport).mockResolvedValue(historical);
    renderPage();

    await screen.findByRole("heading", { name: "AI新闻资讯" });
    fireEvent.change(screen.getByLabelText("选择周报"), { target: { value: historical.reportId } });
    await waitFor(() =>
      expect(aiNewsClient.getAiNewsReport).toHaveBeenCalledWith(historical.reportId),
    );
    expect(await screen.findByRole("heading", { name: "第33周周报" })).toBeInTheDocument();
  });
});
