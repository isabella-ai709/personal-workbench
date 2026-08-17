import { readFile, stat } from "node:fs/promises";
import { normalize } from "node:path";

import type { SkillOrigin, SkillSummary } from "../../../shared/contracts";
import { WorkbenchError } from "../../../shared/errors";
import type { SkillMetadata } from "../../integrations/codex/app-server-client";
import type { SkillGateway } from "../../integrations/codex/skill-gateway";
import type { FolderOpener, RecycleBin } from "../../integrations/windows-shell";
import { stablePathId } from "../../security/path-policy";
import type { SkillCacheRepository } from "./skill-cache-repository";
import type { SkillOriginOverride, SkillOriginRepository } from "./skill-origin-repository";

interface SkillEntry {
  id: string;
  metadata: SkillMetadata;
  origin: SkillOrigin;
  stale: boolean;
}

export interface SkillDetail extends SkillSummary {
  content: string;
}

export function classifySkillOrigin(
  metadata: SkillMetadata,
  override?: SkillOriginOverride | null,
): SkillOrigin {
  if (metadata.scope === "system" || metadata.scope === "admin") return "system";
  const normalizedPath = normalize(metadata.path).replaceAll("\\", "/").toLowerCase();
  if (normalizedPath.includes("/.codex/plugins/") || normalizedPath.includes("/plugins/cache/")) {
    return "plugin";
  }
  return override?.origin ?? "unconfirmed";
}

export class SkillService {
  private entries = new Map<string, SkillEntry>();

  constructor(
    private readonly gateway: SkillGateway,
    private readonly origins: SkillOriginRepository,
    private readonly cache: SkillCacheRepository,
    private readonly folderOpener: FolderOpener,
    private readonly recycleBin: RecycleBin,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.loadCache();
  }

  async list(): Promise<SkillSummary[]> {
    try {
      await this.loadLive(true);
    } catch (error) {
      if (!(error instanceof WorkbenchError && error.code === "UNAVAILABLE")) throw error;
      if (this.entries.size === 0) {
        throw new WorkbenchError("UNAVAILABLE", "Codex Skill service is unavailable", 503);
      }
      this.markStale();
    }
    return this.summaries();
  }

  async get(id: string): Promise<SkillDetail> {
    const entry = await this.findTrustedEntry(id);
    const metadata = await stat(entry.metadata.path);
    if (metadata.size > 512 * 1024) {
      throw new WorkbenchError("FORBIDDEN", "Skill instructions are too large to display", 413);
    }
    return {
      ...this.toSummary(entry),
      content: await readFile(entry.metadata.path, "utf8"),
    };
  }

  async setEnabled(id: string, enabled: boolean): Promise<SkillSummary> {
    const entry = await this.findLiveEntry(id);
    const effective = await this.gatewayCall(() =>
      this.gateway.setEnabled(entry.metadata.path, enabled),
    );
    if (effective !== enabled) {
      throw new WorkbenchError("CONFLICT", "Codex did not apply the requested Skill state", 409);
    }
    await this.loadLive(true);
    const refreshed = this.entries.get(id);
    if (!refreshed || refreshed.metadata.enabled !== enabled) {
      throw new WorkbenchError("CONFLICT", "Skill state could not be confirmed after refresh", 409);
    }
    return this.toSummary(refreshed);
  }

  async setOrigin(
    id: string,
    origin: Extract<SkillOrigin, "generated" | "installed" | "unconfirmed">,
  ): Promise<SkillSummary> {
    const entry = await this.findLiveEntry(id);
    if (entry.origin === "system" || entry.origin === "plugin") {
      throw new WorkbenchError(
        "FORBIDDEN",
        "System and plugin Skill origins cannot be changed",
        403,
      );
    }
    this.origins.set(id, entry.metadata.path, origin);
    entry.origin = origin;
    return this.toSummary(entry);
  }

  async openFolder(id: string): Promise<void> {
    const entry = await this.findTrustedEntry(id);
    await this.folderOpener.openSkillFolder(entry.metadata.path);
  }

  async delete(id: string): Promise<void> {
    const entry = await this.findLiveEntry(id);
    if (!this.isDeletable(entry)) {
      throw new WorkbenchError("FORBIDDEN", "This Skill cannot be deleted by the workbench", 403);
    }
    const effective = await this.gatewayCall(() =>
      this.gateway.setEnabled(entry.metadata.path, false),
    );
    if (effective)
      throw new WorkbenchError("CONFLICT", "Skill could not be disabled before deletion", 409);
    await this.recycleBin.moveSkillToRecycleBin(entry.metadata.path);
    this.entries.delete(id);
    this.origins.delete(id);
    this.persistCache(this.now());
  }

  private async findTrustedEntry(id: string): Promise<SkillEntry> {
    if (this.entries.size === 0) await this.list();
    const entry = this.entries.get(id);
    if (!entry) throw new WorkbenchError("NOT_FOUND", "Skill not found", 404);
    return entry;
  }

  private async findLiveEntry(id: string): Promise<SkillEntry> {
    await this.loadLive(true);
    const entry = this.entries.get(id);
    if (!entry) throw new WorkbenchError("NOT_FOUND", "Skill not found", 404);
    return entry;
  }

  private async loadLive(forceReload: boolean): Promise<void> {
    const skills = await this.gatewayCall(() => this.gateway.list(forceReload));
    const refreshedAt = this.now();
    const next = new Map<string, SkillEntry>();
    for (const metadata of skills) {
      const id = stablePathId(metadata.path);
      const override = this.origins.get(id);
      next.set(id, {
        id,
        metadata,
        origin: classifySkillOrigin(metadata, override),
        stale: false,
      });
    }
    this.entries = next;
    this.persistCache(refreshedAt, next);
  }

  private loadCache(): void {
    for (const cached of this.cache.list()) {
      this.entries.set(cached.skillId, {
        id: cached.skillId,
        metadata: cached.metadata,
        origin: classifySkillOrigin(cached.metadata, this.origins.get(cached.skillId)),
        stale: true,
      });
    }
  }

  private markStale(): void {
    for (const entry of this.entries.values()) entry.stale = true;
  }

  private persistCache(refreshedAt: string, entries = this.entries): void {
    this.cache.replaceAll(
      [...entries.values()].map((entry) => ({
        skillId: entry.id,
        metadata: entry.metadata,
        refreshedAt,
      })),
    );
  }

  private summaries(): SkillSummary[] {
    return [...this.entries.values()]
      .map((entry) => this.toSummary(entry))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private toSummary(entry: SkillEntry): SkillSummary {
    return {
      id: entry.id,
      name: entry.metadata.name,
      description: entry.metadata.description,
      scope: entry.metadata.scope,
      origin: entry.origin,
      enabled: entry.metadata.enabled,
      stale: entry.stale,
      deletable: !entry.stale && this.isDeletable(entry),
      location: entry.metadata.path,
    };
  }

  private isDeletable(entry: SkillEntry): boolean {
    return (
      (entry.metadata.scope === "user" || entry.metadata.scope === "repo") &&
      (entry.origin === "generated" || entry.origin === "installed")
    );
  }

  private async gatewayCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof WorkbenchError) throw error;
      throw new WorkbenchError("UNAVAILABLE", "Codex Skill service is unavailable", 503);
    }
  }
}
