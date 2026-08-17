import { describe, expect, it } from "vitest";

import { verifyCodexCapabilities } from "../../scripts/verify-codex-capabilities";

const runRealIntegration = process.env.RUN_CODEX_INTEGRATION === "1";

describe.skipIf(!runRealIntegration)("local Codex capabilities", () => {
  it("lists Skills, safely toggles an isolated fixture, and executes an SDK turn", async () => {
    const report = await verifyCodexCapabilities();

    expect(report.codexVersion).toMatch(/codex/i);
    expect(report.fixtureToggleRestored).toBe(true);
    expect(report.sdkThreadId).not.toBe("");
    expect(report.sdkFinalResponse).toContain("WORKBENCH_CODEX_OK");
  }, 300_000);
});
