// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as notificationClient from "../../src/client/api/notification-client";
import { NotificationsPage } from "../../src/client/pages/notifications-page";
import type { Notification } from "../../src/shared/notification-contracts";

vi.mock("../../src/client/api/notification-client", () => ({
  getNotifications: vi.fn(),
  setNotificationStatus: vi.fn(),
  snoozeNotification: vi.fn(),
  runNotificationAction: vi.fn(),
}));

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Badge: Box,
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
    Dialog: Box,
    DialogActions: Box,
    DialogBody: Box,
    DialogContent: Box,
    DialogSurface: Box,
    DialogTitle: Box,
    MessageBar: Box,
    MessageBarBody: Box,
    Spinner: ({ label }: { label?: string }) => <div>{label}</div>,
  };
});

const message: Notification = {
  id: "22222222-2222-4222-8222-222222222222",
  sourceModule: "business",
  sourceType: "partnership",
  sourceId: "partnership-1",
  eventType: "deadline",
  sourceVersion: "2026-08-27T10:00:00+08:00",
  title: "商务合作提醒：渠道合作",
  body: "该合作即将截止，请确认下一步。",
  severity: "important",
  status: "unread",
  occurredAt: "2026-08-20T01:00:00.000Z",
  dueAt: "2026-08-27T10:00:00+08:00",
  snoozedUntil: null,
  resolvedAt: null,
  ignoredAt: null,
  createdAt: "2026-08-20T01:00:00.000Z",
  updatedAt: "2026-08-20T01:00:00.000Z",
  deliveryChannel: "in_app",
  metadata: {
    href: "/business",
    sourceLabel: "商务合作",
    allowedNext: "proposal_confirmed,paused",
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NotificationsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("notifications page", () => {
  it("renders an important business reminder and marks it read", async () => {
    vi.mocked(notificationClient.getNotifications).mockResolvedValue({
      items: [message],
      nextCursor: null,
    });
    vi.mocked(notificationClient.setNotificationStatus).mockResolvedValue({
      ...message,
      status: "read",
    });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "商务合作提醒：渠道合作" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("重要")).toHaveLength(2);
    expect(screen.getByRole("option", { name: "方案已确认" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "标记已读" }));
    await waitFor(() =>
      expect(notificationClient.setNotificationStatus).toHaveBeenCalledWith(message.id, "read"),
    );
  });

  it("shows the empty state when no messages match", async () => {
    vi.mocked(notificationClient.getNotifications).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderPage();
    expect(await screen.findByText("当前没有需要关注的消息")).toBeInTheDocument();
  });
});
