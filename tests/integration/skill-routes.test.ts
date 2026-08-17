import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { openDatabase, type WorkbenchDatabase } from "../../src/server/db/connection";
import { migrateDatabase } from "../../src/server/db/migrate";
import type { SkillMetadata } from "../../src/server/integrations/codex/app-server-client";
import type { SkillGateway } from "../../src/server/integrations/codex/skill-gateway";
import type { FolderOpener, RecycleBin } from "../../src/server/integrations/windows-shell";
import { SkillCacheRepository } from "../../src/server/modules/skills/skill-cache-repository";
import { SkillOriginRepository } from "../../src/server/modules/skills/skill-origin-repository";
import { SkillService } from "../../src/server/modules/skills/skill-service";
import type { TaskService } from "../../src/server/modules/tasks/task-service";

class FakeGateway implements SkillGateway {
  unavailable = false;
  skills: SkillMetadata[];
  writes: Array<{ path: string; enabled: boolean }> = [];

  constructor(skills: SkillMetadata[]) {
    this.skills = skills;
  }

  async list(): Promise<SkillMetadata[]> {
    if (this.unavailable) throw new Error("offline");
    return this.skills.map((skill) => ({ ...skill }));
  }

  async setEnabled(path: string, enabled: boolean): Promise<boolean> {
    if (this.unavailable) throw new Error("offline");
    const skill = this.skills.find((candidate) => candidate.path === path);
    if (!skill) throw new Error("missing");
    skill.enabled = enabled;
    this.writes.push({ path, enabled });
    return enabled;
  }
}

class FakeFolderOpener implements FolderOpener {
  opened: string[] = [];
  async openSkillFolder(path: string): Promise<void> {
    this.opened.push(path);
  }
}

class FakeRecycleBin implements RecycleBin {
  moved: string[] = [];
  async moveSkillToRecycleBin(path: string): Promise<void> {
    this.moved.push(path);
  }
}

const resources: Array<{ app: ReturnType<typeof buildApp>; database: WorkbenchDatabase }> = [];

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.app.close();
    resource.database.close();
  }
});

function setup(scope: SkillMetadata["scope"] = "user") {
  const path = resolve("tests/fixtures/skills/workbench-capability-test/SKILL.md");
  const gateway = new FakeGateway([
    {
      name: "workbench-capability-test",
      description: "Fixture Skill",
      path,
      scope,
      enabled: true,
    },
  ]);
  const database = openDatabase(":memory:");
  migrateDatabase(database);
  const folder = new FakeFolderOpener();
  const recycleBin = new FakeRecycleBin();
  const service = new SkillService(
    gateway,
    new SkillOriginRepository(database),
    new SkillCacheRepository(database),
    folder,
    recycleBin,
    () => "2026-08-17T00:00:00.000Z",
  );
  const app = buildApp({} as TaskService, service);
  resources.push({ app, database });
  return { app, gateway, folder, recycleBin };
}

describe("Skill routes", () => {
  it("lists, reads, classifies, toggles, opens, and safely deletes a user Skill", async () => {
    const { app, gateway, folder, recycleBin } = setup();
    const listed = await app.inject({ method: "GET", url: "/api/skills" });
    expect(listed.statusCode).toBe(200);
    const skill = listed.json().items[0];
    expect(skill).toMatchObject({ origin: "unconfirmed", deletable: false, stale: false });

    const detail = await app.inject({ method: "GET", url: `/api/skills/${skill.id}` });
    expect(detail.json().content).toContain("Workbench capability test");

    const classified = await app.inject({
      method: "PATCH",
      url: `/api/skills/${skill.id}/origin`,
      payload: { origin: "generated" },
    });
    expect(classified.json()).toMatchObject({ origin: "generated", deletable: true });

    const disabled = await app.inject({ method: "POST", url: `/api/skills/${skill.id}/disable` });
    expect(disabled.json().enabled).toBe(false);
    await app.inject({ method: "POST", url: `/api/skills/${skill.id}/open-folder` });
    expect(folder.opened).toEqual([gateway.skills[0]!.path]);

    const deleted = await app.inject({ method: "DELETE", url: `/api/skills/${skill.id}` });
    expect(deleted.statusCode).toBe(204);
    expect(gateway.writes.at(-1)).toEqual({ path: gateway.skills[0]!.path, enabled: false });
    expect(recycleBin.moved).toEqual([gateway.skills[0]!.path]);
  });

  it("protects system Skills from reclassification and deletion", async () => {
    const { app } = setup("system");
    const skill = (await app.inject({ method: "GET", url: "/api/skills" })).json().items[0];
    expect(skill).toMatchObject({ origin: "system", deletable: false });

    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/skills/${skill.id}/origin`,
          payload: { origin: "generated" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: "DELETE", url: `/api/skills/${skill.id}` })).statusCode,
    ).toBe(403);
  });

  it("falls back to a persistent read-only cache when Codex is unavailable", async () => {
    const { app, gateway } = setup();
    const live = await app.inject({ method: "GET", url: "/api/skills" });
    const skill = live.json().items[0];
    gateway.unavailable = true;

    const cached = await app.inject({ method: "GET", url: "/api/skills" });
    expect(cached.statusCode).toBe(200);
    expect(cached.json().items[0]).toMatchObject({ stale: true, deletable: false });
    const write = await app.inject({ method: "POST", url: `/api/skills/${skill.id}/disable` });
    expect(write.statusCode).toBe(503);
    expect(write.json()).toMatchObject({ error: { code: "UNAVAILABLE" } });
  });
});
