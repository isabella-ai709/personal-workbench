// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as businessClient from "../../src/client/api/business-client";
import { BusinessPage } from "../../src/client/pages/business-page";

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Badge: Box,
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
      "aria-label": label,
    }: {
      value?: string;
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
    Select: ({
      value,
      onChange,
      children,
      "aria-label": label,
      name,
    }: {
      value?: string;
      onChange?: (event: ChangeEvent<HTMLSelectElement>, data: { value: string }) => void;
      children?: ReactNode;
      "aria-label"?: string;
      name?: string;
    }) => (
      <select
        name={name}
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      >
        {children}
      </select>
    ),
    Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
    TabList: ({ children }: { children?: ReactNode }) => <div role="tablist">{children}</div>,
    Tab: ({ children }: { children?: ReactNode }) => <button role="tab">{children}</button>,
    Textarea: ({
      value,
      onChange,
      name,
    }: {
      value?: string;
      onChange?: (event: ChangeEvent<HTMLTextAreaElement>, data: { value: string }) => void;
      name?: string;
    }) => (
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
  };
});

vi.mock("../../src/client/api/business-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/client/api/business-client")>();
  return {
    ...original,
    getBusinessDashboard: vi.fn(),
    getCompanies: vi.fn(),
    getContacts: vi.fn(),
    getOpportunities: vi.fn(),
    getPartnerships: vi.fn(),
    getActivities: vi.fn(),
    getFollowUps: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setupMocks() {
  vi.mocked(businessClient.getBusinessDashboard).mockResolvedValue({
    followUps: { dueToday: 1, overdue: 2, nextSevenDays: 3 },
    opportunities: {
      active: 4,
      amountMinor: 25600000,
      byStage: {
        lead: 1,
        contacted: 1,
        needs_confirmed: 1,
        proposal: 1,
        negotiation: 0,
        won: 0,
        lost: 0,
      },
    },
    activePartnerships: 2,
    companies: 3,
    contacts: 5,
    recentActivities: [],
  });
  vi.mocked(businessClient.getCompanies).mockResolvedValue([]);
  vi.mocked(businessClient.getContacts).mockResolvedValue([]);
  vi.mocked(businessClient.getOpportunities).mockResolvedValue([]);
  vi.mocked(businessClient.getPartnerships).mockResolvedValue([]);
  vi.mocked(businessClient.getActivities).mockResolvedValue([]);
  vi.mocked(businessClient.getFollowUps).mockResolvedValue([]);
}

describe("business page", () => {
  it("shows real business summary and primary work areas", async () => {
    setupMocks();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <BusinessPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "商务对接" })).toBeInTheDocument();
    expect(await screen.findByText(/¥256,000 预计金额/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "公司与联系人" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 整理" })).toBeInTheDocument();
    expect(screen.getByText("当前没有跟进事项。")).toBeInTheDocument();
  });
});
