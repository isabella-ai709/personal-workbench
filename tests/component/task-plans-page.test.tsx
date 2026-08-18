// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, getTaskPlans, setTaskPlanStatus } from "../../src/client/api/client";
import { TaskPlansPage } from "../../src/client/pages/task-plans-page";
import type { TaskPlan } from "../../src/shared/task-plan-contracts";

vi.mock("../../src/client/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/client/api/client")>();
  return {
    ...original,
    createTaskPlan: vi.fn(),
    deleteTaskPlan: vi.fn(),
    getTaskPlans: vi.fn(),
    restoreTaskPlan: vi.fn(),
    setTaskPlanStatus: vi.fn(),
    updateTaskPlan: vi.fn(),
  };
});

vi.mock("../../src/client/features/task-plans/task-plan-form", () => ({
  TaskPlanForm: () => null,
}));

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Badge: Box,
    Button: ({
      children,
      onClick,
      disabled,
      "aria-label": label,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      "aria-label"?: string;
    }) => (
      <button aria-label={label} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogActions: Box,
    DialogBody: Box,
    DialogContent: Box,
    DialogSurface: Box,
    DialogTitle: Box,
    Input: ({
      value,
      onChange,
      placeholder,
      "aria-label": label,
    }: {
      value: string;
      onChange?: (event: ChangeEvent<HTMLInputElement>, data: { value: string }) => void;
      placeholder?: string;
      "aria-label"?: string;
    }) => (
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
    MessageBar: Box,
    MessageBarBody: Box,
    Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
  };
});

const base: TaskPlan = {
  id: "7ed05fe2-9767-4755-864d-8261508c9696",
  type: "plan",
  title: "规划个人知识库",
  status: "pending",
  priority: "high",
  dueAt: "2020-08-18T00:00:00.000Z",
  nextAction: "整理现有目录",
  notes: "",
  completedAt: null,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
  deletedAt: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TaskPlansPage />
    </QueryClientProvider>,
  );
}

describe("task plans page", () => {
  it("shows the focus group and keeps ideas in their own view", async () => {
    vi.mocked(getTaskPlans).mockResolvedValue([
      base,
      {
        ...base,
        id: "7ed05fe2-9767-4755-864d-8261508c9697",
        title: "读书输出栏目",
        type: "idea",
        dueAt: null,
      },
    ]);
    renderPage();

    expect(await screen.findByText("计划时间已过")).toBeInTheDocument();
    expect(screen.getAllByText("规划个人知识库").length).toBeGreaterThan(0);
    expect(screen.queryByText("读书输出栏目")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "全部" }));
    fireEvent.change(screen.getByLabelText("筛选任务计划"), {
      target: { value: "type:idea" },
    });
    expect((await screen.findAllByText("读书输出栏目")).length).toBeGreaterThan(0);
    expect(screen.queryByText("规划个人知识库")).not.toBeInTheDocument();
  });

  it("keeps server failures visible after a quick status change", async () => {
    vi.mocked(getTaskPlans).mockResolvedValue([base]);
    vi.mocked(setTaskPlanStatus).mockRejectedValue(
      new ApiClientError("状态更新失败", 409, "CONFLICT"),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "完成 规划个人知识库" }));
    expect(await screen.findByText("状态更新失败")).toBeInTheDocument();
  });
});
