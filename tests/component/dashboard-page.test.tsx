// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDashboard } from "../../src/client/api/client";
import { DashboardPage } from "../../src/client/pages/dashboard-page";
import type { DashboardSummary } from "../../src/shared/contracts";

vi.mock("../../src/client/api/client", () => ({ getDashboard: vi.fn() }));
vi.mock("@fluentui/react-components", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  MessageBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageBarBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Skeleton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SkeletonItem: () => <div />,
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { value: ResizeObserverStub, configurable: true });

const summary: DashboardSummary = {
  tasks: { total: 3, enabled: 2, paused: 1, failedRuns: 1 },
  skills: { total: 8, enabled: 6, stale: false },
  recentRuns: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("dashboard page", () => {
  it("renders source-backed task and Skill statistics", async () => {
    vi.mocked(getDashboard).mockResolvedValue(summary);
    renderPage();
    expect(screen.getByLabelText("正在加载首页")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "首页" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("共发现 8 个")).toBeInTheDocument();
    expect(screen.getByText("还没有运行记录。创建任务后，结果会显示在这里。")).toBeInTheDocument();
  });

  it("makes stale Skill data explicit", async () => {
    vi.mocked(getDashboard).mockResolvedValue({
      ...summary,
      skills: { ...summary.skills, stale: true },
    });
    renderPage();
    expect(await screen.findByText(/当前显示上次缓存/)).toBeInTheDocument();
  });

  it("shows a recoverable service error", async () => {
    vi.mocked(getDashboard).mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText(/工作台数据暂时无法读取/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeEnabled();
  });
});
