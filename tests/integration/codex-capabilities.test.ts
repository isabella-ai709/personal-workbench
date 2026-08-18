import { describe, expect, it } from "vitest";

import { verifyCodexCapabilities } from "../../scripts/verify-codex-capabilities";

const runRealIntegration = process.env.RUN_CODEX_INTEGRATION === "1";

describe.skipIf(!runRealIntegration)("local Codex capabilities", () => {
  it("lists Skills and safely toggles an isolated fixture", async () => {
    const report = await verifyCodexCapabilities();

    expect(report.codexVersion).toMatch(/codex/i);
    expect(report.fixtureToggleRestored).toBe(true);
    expect(report.installedSkillCount).toBeGreaterThanOrEqual(0);
  }, 300_000);
});
