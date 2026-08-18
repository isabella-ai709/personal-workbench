import { describe, expect, it } from "vitest";

import { WORKBENCH_NAME } from "../../src/shared/contracts";

describe("workbench scaffold", () => {
  it("exposes the confirmed product name", () => {
    expect(WORKBENCH_NAME).toBe("个人 Codex 工作台");
  });
});
