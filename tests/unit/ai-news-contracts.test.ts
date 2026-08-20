import { describe, expect, it } from "vitest";

import { aiNewsIngestSchema } from "../../src/shared/ai-news-contracts";
import { aiNewsIngestFixture } from "../fixtures/ai-news-report";

describe("AI news contracts", () => {
  it("accepts a complete versioned weekly report", () => {
    expect(aiNewsIngestSchema.parse(aiNewsIngestFixture()).report.report_id).toBe(
      "ai-weekly-2026-W34",
    );
  });

  it("rejects unknown versions, invalid periods, and negative statistics", () => {
    expect(() =>
      aiNewsIngestSchema.parse({ ...aiNewsIngestFixture(), schemaVersion: 2 }),
    ).toThrow();
    const invalidWeek = aiNewsIngestFixture();
    invalidWeek.report.week = 54;
    expect(() => aiNewsIngestSchema.parse(invalidWeek)).toThrow();
    const invalidStats = aiNewsIngestFixture();
    invalidStats.report.stats.failed_sources = -1;
    expect(() => aiNewsIngestSchema.parse(invalidStats)).toThrow();
  });

  it("only accepts the AI新闻资讯 category", () => {
    const input = aiNewsIngestFixture();
    (input.report as { category: string }).category = "时序Lab";
    expect(() => aiNewsIngestSchema.parse(input)).toThrow();
  });
});
