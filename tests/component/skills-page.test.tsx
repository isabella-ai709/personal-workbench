// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSkill, getSkills } from "../../src/client/api/client";
import { SkillsPage } from "../../src/client/pages/skills-page";
import type { SkillSummary } from "../../src/shared/contracts";

vi.mock("../../src/client/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/client/api/client")>();
  return {
    ...original,
    deleteSkill: vi.fn(),
    getSkill: vi.fn(),
    getSkills: vi.fn(),
    openSkillFolder: vi.fn(),
    setSkillEnabled: vi.fn(),
    setSkillOrigin: vi.fn(),
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
vi.mock("../../src/client/features/skills/skill-list", () => ({
  SkillList: ({
    skills,
    onSelect,
  }: {
    skills: SkillSummary[];
    onSelect: (skill: SkillSummary) => void;
  }) => (
    <div>
      {skills.map((skill) => (
        <button key={skill.id} onClick={() => onSelect(skill)}>
          {skill.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../../src/client/features/skills/skill-detail", () => ({
  SkillDetail: ({ skill, onDelete }: { skill: SkillSummary; onDelete: () => void }) => (
    <div>
      <span>详情：{skill.name}</span>
      {skill.deletable ? <button onClick={onDelete}>删除</button> : null}
    </div>
  ),
}));

const installed: SkillSummary = {
  id: "a".repeat(64),
  name: "会议整理",
  description: "整理会议记录",
  scope: "user",
  origin: "installed",
  enabled: true,
  stale: false,
  deletable: true,
  location: "C:\\skills\\meeting",
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
      <SkillsPage />
    </QueryClientProvider>,
  );
}

describe("skills page", () => {
  it("shows discoverable Skills and the recycle-bin delete contract", async () => {
    vi.mocked(getSkills).mockResolvedValue([installed]);
    vi.mocked(getSkill).mockResolvedValue({ ...installed, content: "# 会议整理" });
    renderPage();
    expect(await screen.findByText("会议整理")).toBeInTheDocument();
    expect(await screen.findByText("详情：会议整理")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(
      screen.getByText(/先停用这个 Skill，再将整个 Skill 目录移入 Windows 系统回收站/),
    ).toBeInTheDocument();
  });

  it("marks cached data as read-only", async () => {
    vi.mocked(getSkills).mockResolvedValue([{ ...installed, stale: true, deletable: false }]);
    vi.mocked(getSkill).mockResolvedValue({
      ...installed,
      stale: true,
      deletable: false,
      content: "cached",
    });
    renderPage();
    expect(await screen.findByText(/当前显示上次缓存/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
  });
});
