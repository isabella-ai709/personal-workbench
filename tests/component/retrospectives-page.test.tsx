// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../src/client/api/client";
import * as retrospectiveClient from "../../src/client/api/retrospective-client";
import { RetrospectivesPage } from "../../src/client/pages/retrospectives-page";
import type { Retrospective } from "../../src/shared/retrospective-contracts";

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      children,
      onClick,
      disabled,
      type = "button",
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      type?: "button" | "submit";
    }) => (
      <button type={type} onClick={onClick} disabled={disabled}>
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
    Field: ({ label, children }: { label?: string; children?: ReactNode }) => (
      <label>
        {label}
        {children}
      </label>
    ),
    Input: ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (event: ChangeEvent<HTMLInputElement>, data: { value: string }) => void;
      placeholder?: string;
    }) => (
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
    MessageBar: Box,
    MessageBarBody: Box,
    Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
    Textarea: ({
      value,
      onChange,
    }: {
      value?: string;
      onChange?: (event: ChangeEvent<HTMLTextAreaElement>, data: { value: string }) => void;
    }) => (
      <textarea
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
  };
});

vi.mock("../../src/client/api/retrospective-client", () => ({
  analyzeRetrospective: vi.fn(),
  getRetrospectives: vi.fn(),
  createRetrospective: vi.fn(),
  updateRetrospective: vi.fn(),
  deleteRetrospective: vi.fn(),
}));

const record: Retrospective = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  title: "客户沟通复盘",
  review: "沟通了新的需求",
  didWell: "提前准备",
  didWrong: "追问不足",
  lesson: "先听再说",
  nextImprovement: "列出三个追问",
  createdAt: "2026-08-18T08:00:00.000Z",
  updatedAt: "2026-08-18T08:00:00.000Z",
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
      <RetrospectivesPage />
    </QueryClientProvider>,
  );
}

describe("retrospectives page", () => {
  it("creates a retrospective from the single-page form", async () => {
    vi.mocked(retrospectiveClient.getRetrospectives)
      .mockResolvedValueOnce([])
      .mockResolvedValue([record]);
    vi.mocked(retrospectiveClient.createRetrospective).mockResolvedValue(record);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "新建复盘" }));
    fireEvent.change(screen.getByPlaceholderText("例如：今天与客户沟通的复盘"), {
      target: { value: "客户沟通复盘" },
    });
    fireEvent.change(screen.getByLabelText("事情回顾"), { target: { value: "沟通了新的需求" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    await waitFor(() =>
      expect(retrospectiveClient.createRetrospective).toHaveBeenCalledWith(
        expect.objectContaining({ title: "客户沟通复盘", review: "沟通了新的需求" }),
      ),
    );
    expect(await screen.findByRole("heading", { name: "客户沟通复盘" })).toBeInTheDocument();
  });

  it("keeps entered content when saving fails", async () => {
    vi.mocked(retrospectiveClient.getRetrospectives).mockResolvedValue([]);
    vi.mocked(retrospectiveClient.createRetrospective).mockRejectedValue(
      new ApiClientError("复盘暂时无法保存", 500),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "新建复盘" }));
    const title = screen.getByPlaceholderText("例如：今天与客户沟通的复盘");
    fireEvent.change(title, { target: { value: "不要丢失" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    expect(await screen.findByText("复盘暂时无法保存")).toBeInTheDocument();
    expect(title).toHaveValue("不要丢失");
  });

  it("requires confirmation before deleting", async () => {
    vi.mocked(retrospectiveClient.getRetrospectives).mockResolvedValue([record]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "客户沟通复盘" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.getByText("删除这条复盘？")).toBeInTheDocument();
    expect(retrospectiveClient.deleteRetrospective).not.toHaveBeenCalled();
  });

  it("exposes the reserved AI analysis entry point", async () => {
    vi.mocked(retrospectiveClient.getRetrospectives).mockResolvedValue([record]);
    vi.mocked(retrospectiveClient.analyzeRetrospective).mockRejectedValue(
      new ApiClientError("经验复盘 AI 分析尚未配置，请先配置 AI 服务", 503),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "客户沟通复盘" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI 分析" }));
    expect(
      await screen.findByText("经验复盘 AI 分析尚未配置，请先配置 AI 服务"),
    ).toBeInTheDocument();
    expect(retrospectiveClient.analyzeRetrospective).toHaveBeenCalledWith(record.id);
  });
});
