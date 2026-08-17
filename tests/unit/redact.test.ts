import { describe, expect, it } from "vitest";

import { redactText } from "../../src/server/integrations/codex/redact";

describe("redactText", () => {
  it("redacts common tokens, authorization headers, and sensitive environment values", () => {
    const text = [
      "sk-proj-abcdefghijklmnopqrstuvwxyz123456",
      "Bearer abcdefghijklmnopqrstuvwxyz.123456",
      "api_key=plain-secret-value",
      "environment-secret-123",
    ].join("\n");

    const redacted = redactText(text, { WORKBENCH_SECRET: "environment-secret-123" });

    expect(redacted).not.toContain("sk-proj-");
    expect(redacted).not.toContain("Bearer abc");
    expect(redacted).not.toContain("plain-secret-value");
    expect(redacted).not.toContain("environment-secret-123");
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("does not redact short ordinary values", () => {
    expect(redactText("status=ok", { API_KEY: "short" })).toBe("status=ok");
  });
});
