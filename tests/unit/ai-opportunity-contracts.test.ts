import { describe, expect, it } from "vitest";
import { aiOpportunityIngestSchema } from "../../src/shared/ai-opportunity-contracts";
import { aiOpportunityIngestFixture } from "../fixtures/ai-opportunity-report";

describe("AI opportunity contracts", () => {
  it("accepts a versioned Xiaod report", () => {
    expect(aiOpportunityIngestSchema.parse(aiOpportunityIngestFixture()).report.category).toBe(
      "小D机会",
    );
  });
  it("rejects wrong versions, categories, and negative stats", () => {
    expect(() =>
      aiOpportunityIngestSchema.parse({ ...aiOpportunityIngestFixture(), schemaVersion: 2 }),
    ).toThrow();
    const wrong = aiOpportunityIngestFixture();
    (wrong.report as { category: string }).category = "AI新闻资讯";
    expect(() => aiOpportunityIngestSchema.parse(wrong)).toThrow();
    const negative = aiOpportunityIngestFixture();
    negative.report.stats.failed_sources = -1;
    expect(() => aiOpportunityIngestSchema.parse(negative)).toThrow();
  });
});
