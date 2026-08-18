// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskPlanForm } from "../../src/client/features/task-plans/task-plan-form";

vi.mock("@fluentui/react-components", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      children,
      type,
      disabled,
      onClick,
    }: {
      children?: ReactNode;
      type?: "button" | "submit";
      disabled?: boolean;
      onClick?: () => void;
    }) => (
      <button type={type} disabled={disabled} onClick={onClick}>
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
      ...props
    }: {
      value: string;
      onChange?: (event: ChangeEvent<HTMLInputElement>, data: { value: string }) => void;
    }) => (
      <input
        {...props}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
    Select: ({
      value,
      onChange,
      children,
    }: {
      value: string;
      onChange?: (event: ChangeEvent<HTMLSelectElement>, data: { value: string }) => void;
      children?: ReactNode;
    }) => (
      <select value={value} onChange={(event) => onChange?.(event, { value: event.target.value })}>
        {children}
      </select>
    ),
    Textarea: ({
      value,
      onChange,
      ...props
    }: {
      value: string;
      onChange?: (event: ChangeEvent<HTMLTextAreaElement>, data: { value: string }) => void;
    }) => (
      <textarea
        {...props}
        value={value}
        onChange={(event) => onChange?.(event, { value: event.target.value })}
      />
    ),
  };
});

afterEach(cleanup);

describe("TaskPlanForm", () => {
  it("submits the selected local plan time as an ISO timestamp", () => {
    const onSubmit = vi.fn();
    render(
      <TaskPlanForm open busy={false} onClose={vi.fn()} onSubmit={onSubmit} taskPlan={null} />,
    );

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "整理本周重点" } });
    fireEvent.input(screen.getByLabelText("计划时间"), {
      target: { value: "2026-08-19T18:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "整理本周重点",
        dueAt: new Date("2026-08-19T18:00").toISOString(),
      }),
    );
  });
});
