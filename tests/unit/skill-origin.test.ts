import { describe, expect, it } from "vitest";

import type { SkillMetadata } from "../../src/server/integrations/codex/app-server-client";
import {
  classifySkillOrigin,
  isPluginSkillPath,
} from "../../src/server/modules/skills/skill-service";

function metadata(path: string, scope: SkillMetadata["scope"] = "user"): SkillMetadata {
  return { name: "example", description: "Example", path, scope, enabled: true };
}

describe("Skill origin classification", () => {
  it("protects system and plugin Skills before applying manual records", () => {
    const override = {
      skillId: "id",
      canonicalPath: "path",
      origin: "generated" as const,
      updatedAt: "2026-08-17T00:00:00.000Z",
    };
    expect(classifySkillOrigin(metadata("C:/skills/system", "system"), override)).toBe("system");
    expect(
      classifySkillOrigin(metadata("C:/Users/me/.codex/plugins/cache/demo/SKILL.md"), override),
    ).toBe("plugin");
  });

  it("recognizes plugin cache paths across Windows path variants", () => {
    expect(isPluginSkillPath("C:\\Users\\me\\.codex\\plugins\\cache\\demo\\SKILL.md")).toBe(true);
    expect(isPluginSkillPath("D:/Codex/plugins/cache/demo/SKILL.md")).toBe(true);
    expect(isPluginSkillPath("C:/Users/me/.codex/plugin-cache/demo/SKILL.md")).toBe(true);
    expect(isPluginSkillPath("C:/Users/me/skills/demo/SKILL.md")).toBe(false);
  });

  it("uses explicit generated or installed records and leaves unknown users unconfirmed", () => {
    expect(classifySkillOrigin(metadata("C:/skills/mine"))).toBe("unconfirmed");
    expect(
      classifySkillOrigin(metadata("C:/skills/mine"), {
        skillId: "id",
        canonicalPath: "path",
        origin: "installed",
        updatedAt: "2026-08-17T00:00:00.000Z",
      }),
    ).toBe("installed");
  });
});
