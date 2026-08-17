import { describe, expect, it } from "vitest";

import { isPathInside, stablePathId } from "../../src/server/security/path-policy";

describe("path policy", () => {
  it("creates stable opaque ids from canonical paths", () => {
    expect(stablePathId("C:/skills/example")).toHaveLength(64);
    expect(stablePathId("C:/skills/example")).toBe(stablePathId("C:/skills/example"));
  });

  it("accepts descendants but rejects similarly prefixed sibling paths", () => {
    expect(isPathInside("C:/workbench/logs", "C:/workbench/logs/run.jsonl")).toBe(true);
    expect(isPathInside("C:/workbench/logs", "C:/workbench/logs-secret/run.jsonl")).toBe(false);
  });
});
