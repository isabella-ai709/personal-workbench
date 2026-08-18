import type { SkillOrigin } from "../../../shared/contracts";
import type { WorkbenchDatabase } from "../../db/connection";

export interface SkillOriginOverride {
  skillId: string;
  canonicalPath: string;
  origin: Extract<SkillOrigin, "generated" | "installed" | "unconfirmed">;
  updatedAt: string;
}

interface SkillOriginRow {
  skill_id: string;
  canonical_path: string;
  origin: SkillOriginOverride["origin"];
  updated_at: string;
}

function mapRow(row: SkillOriginRow): SkillOriginOverride {
  return {
    skillId: row.skill_id,
    canonicalPath: row.canonical_path,
    origin: row.origin,
    updatedAt: row.updated_at,
  };
}

export class SkillOriginRepository {
  constructor(
    private readonly database: WorkbenchDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  set(
    skillId: string,
    canonicalPath: string,
    origin: SkillOriginOverride["origin"],
  ): SkillOriginOverride {
    this.database
      .prepare(
        `INSERT INTO skill_origin_overrides(skill_id, canonical_path, origin, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET
           canonical_path = excluded.canonical_path,
           origin = excluded.origin,
           updated_at = excluded.updated_at`,
      )
      .run(skillId, canonicalPath, origin, this.now());
    return this.get(skillId)!;
  }

  get(skillId: string): SkillOriginOverride | null {
    const row = this.database
      .prepare("SELECT * FROM skill_origin_overrides WHERE skill_id = ?")
      .get(skillId) as SkillOriginRow | undefined;
    return row ? mapRow(row) : null;
  }

  list(): SkillOriginOverride[] {
    return (
      this.database
        .prepare("SELECT * FROM skill_origin_overrides ORDER BY updated_at DESC")
        .all() as unknown as SkillOriginRow[]
    ).map(mapRow);
  }

  delete(skillId: string): boolean {
    return (
      this.database.prepare("DELETE FROM skill_origin_overrides WHERE skill_id = ?").run(skillId)
        .changes > 0
    );
  }
}
