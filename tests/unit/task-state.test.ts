import { describe, expect, it } from "vitest";

import {
  assertRunTimeline,
  assertTaskRunTransition,
  canTransitionTaskRun,
} from "../../src/shared/task-state";

describe("task run state machine", () => {
  it("allows the planned lifecycle transitions", () => {
    expect(canTransitionTaskRun("pending", "running")).toBe(true);
    expect(canTransitionTaskRun("pending", "missed")).toBe(true);
    expect(canTransitionTaskRun("running", "succeeded")).toBe(true);
    expect(canTransitionTaskRun("running", "failed")).toBe(true);
  });

  it("rejects skips and repeated terminal transitions", () => {
    expect(() => assertTaskRunTransition("pending", "succeeded")).toThrow("cannot transition");
    expect(() => assertTaskRunTransition("succeeded", "succeeded")).toThrow("cannot transition");
    expect(() => assertTaskRunTransition("failed", "running")).toThrow("cannot transition");
  });

  it("requires timestamps that match the current state", () => {
    expect(() =>
      assertRunTimeline({ status: "running", startedAt: null, finishedAt: null }),
    ).toThrow("requires a start timestamp");
    expect(() =>
      assertRunTimeline({
        status: "succeeded",
        startedAt: "2026-08-17T10:00:01.000Z",
        finishedAt: "2026-08-17T10:00:00.000Z",
      }),
    ).toThrow("finish before");
    expect(() =>
      assertRunTimeline({
        status: "missed",
        startedAt: null,
        finishedAt: "2026-08-17T10:00:00.000Z",
      }),
    ).not.toThrow();
  });
});
