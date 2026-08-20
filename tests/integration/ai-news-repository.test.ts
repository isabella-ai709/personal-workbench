import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import { AiNewsRepository } from "../../src/server/modules/ai-news/ai-news-repository";
import { aiNewsIngestFixture } from "../fixtures/ai-news-report";

const databases: WorkbenchDatabase[] = [];

afterEach(() => {
  databases.splice(0).forEach((database) => database.close());
});

function setup(): AiNewsRepository {
  const database = openDatabase(":memory:");
  databases.push(database);
  migrateDatabase(database);
  return new AiNewsRepository(database);
}

describe("AiNewsRepository", () => {
  it("upserts the same report id without creating duplicates", () => {
    const repository = setup();
    repository.upsert(aiNewsIngestFixture(), "2026-08-19T06:03:00.000Z");
    const changed = aiNewsIngestFixture();
    changed.report.title = "更新后的周报";
    repository.upsert(changed, "2026-08-19T06:04:00.000Z");

    expect(repository.list()).toHaveLength(1);
    expect(repository.get(changed.report.report_id)).toMatchObject({
      title: "更新后的周报",
      importedAt: "2026-08-19T06:04:00.000Z",
    });
  });

  it("returns the newest period first", () => {
    const repository = setup();
    const older = aiNewsIngestFixture("ai-weekly-2026-W33");
    older.report.week = 33;
    repository.upsert(older, "2026-08-12T01:00:00.000Z");
    repository.upsert(aiNewsIngestFixture(), "2026-08-19T01:00:00.000Z");

    expect(repository.list().map((item) => item.week)).toEqual([34, 33]);
    expect(repository.latest()?.reportId).toBe("ai-weekly-2026-W34");
  });
});
