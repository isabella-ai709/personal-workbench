import type { SkillMetadata } from "../../integrations/codex/app-server-client";
import type { WorkbenchDatabase } from "../../db/connection";

interface CacheRow {
  skill_id: string;
  metadata_json: string;
  refreshed_at: string;
}

export interface CachedSkill {
  skillId: string;
  metadata: SkillMetadata;
  refreshedAt: string;
}

export class SkillCacheRepository {
  constructor(private readonly database: WorkbenchDatabase) {}

  replaceAll(skills: CachedSkill[]): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec("DELETE FROM skill_cache");
      const insert = this.database.prepare(
        "INSERT INTO skill_cache(skill_id, metadata_json, refreshed_at) VALUES (?, ?, ?)",
      );
      for (const skill of skills) {
        insert.run(skill.skillId, JSON.stringify(skill.metadata), skill.refreshedAt);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  list(): CachedSkill[] {
    return (
      this.database
        .prepare("SELECT * FROM skill_cache ORDER BY skill_id")
        .all() as unknown as CacheRow[]
    ).map((row) => ({
      skillId: row.skill_id,
      metadata: JSON.parse(row.metadata_json) as SkillMetadata,
      refreshedAt: row.refreshed_at,
    }));
  }
}
