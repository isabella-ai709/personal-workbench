// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, getTaskRuns, getTasks, setTaskEnabled } from "../../src/client/api/client";
import { TasksPage } from "../../src/client/pages/tasks-page";
import type { Task } from "../../src/shared/contracts";

vi.mock("../../src/client/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/client/api/client")>();
  return {
    ...original,
    createTask: vi.fn(),
    deleteTask: vi.fn(),
    getTaskRuns: vi.fn(),
    getTasks: vi.fn(),
    restoreTask: vi.fn(),
    runTask: vi.fn(),
    setTaskEnabled: vi.fn(),
    updateTask: vi.fn(),
  };
});

interface InputStubProps {
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>, data: { value: string }) => void;
  placeholder?: string;
  "aria-label"?: string;
}

interface SelectStubProps {
  value: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>, data: { value: string }) => void;
  children?: ReactNode;
  "aria-label"?: string;
}

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button onClick={onClick} disabled={disabled}>
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
    Input: ({ value, onChange, placeholder, "aria-label": label }: InputStubProps) => (
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
    MessageBar: Box,
    MessageBarBody: Box,
    Select: ({ value, onChange, children, "aria-label": label }: SelectStubProps) => (
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      >
        {children}
      </select>
    ),
    Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
  };
});
vi.mock("../../src/client/features/tasks/task-form", () => ({ TaskForm: () => null }));
vi.mock("../../src/client/features/tasks/run-detail", () => ({
  RunDetail: () => <div>运行详情</div>,
}));
vi.mock("../../src/client/features/tasks/task-list", () => ({
  TaskList: ({
    tasks,
    onSelect,
    onToggle,
  }: {
    tasks: Task[];
    onSelect: (task: Task) => void;
    onToggle: (task: Task) => void;
  }) => (
    <div>
      {tasks.map((task: Task) => (
        <div key={task.id}>
          <button onClick={() => onSelect(task)}>{task.name}</button>
          <button onClick={() => onToggle(task)}>切换状态</button>
        </div>
      ))}
    </div>
  ),
}));

const task: Task = {
  id: "7ed05fe2-9767-4755-864d-8261508c9696",
  name: "晨间整理",
  prompt: "整理今天事项",
  schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  enabled: true,
  nextRunAt: "2026-08-18T00:00:00.000Z",
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
      <TasksPage />
    </QueryClientProvider>,
  );
}

describe("tasks page", () => {
  it("shows tasks and explains the 30 day recovery window before deletion", async () => {
    vi.mocked(getTasks).mockResolvedValue([task]);
    vi.mocked(getTaskRuns).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("晨间整理")).toBeInTheDocument();
    expect(await screen.findByText("整理今天事项")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.getByText(/保留 30 天/)).toBeInTheDocument();
  });

  it("surfaces server conflicts after a state change", async () => {
    vi.mocked(getTasks).mockResolvedValue([task]);
    vi.mocked(getTaskRuns).mockResolvedValue([]);
    vi.mocked(setTaskEnabled).mockRejectedValue(
      new ApiClientError("任务正在运行，暂时不能暂停", 409, "CONFLICT"),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "切换状态" }));
    expect(await screen.findByText("任务正在运行，暂时不能暂停")).toBeInTheDocument();
  });
});
