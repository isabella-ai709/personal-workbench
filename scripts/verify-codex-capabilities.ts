import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  AppServerClient,
  resolveCodexExecutable,
  type SkillMetadata,
} from "../src/server/integrations/codex/app-server-client";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(projectRoot, "tests", "fixtures", "skills");
const fixtureName = "workbench-capability-test";

export interface CapabilityReport {
  codexVersion: string;
  codexExecutable: string;
  appServerUserAgent: string;
  codexHome: string;
  installedSkillCount: number;
  installedSkillNames: string[];
  fixtureSkillPath: string;
  fixtureToggleRestored: boolean;
}

function flattenSkills(response: { data: Array<{ skills: SkillMetadata[] }> }): SkillMetadata[] {
  const byPath = new Map<string, SkillMetadata>();
  for (const entry of response.data) {
    for (const skill of entry.skills) byPath.set(skill.path.toLowerCase(), skill);
  }
  return [...byPath.values()];
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export async function verifyCodexCapabilities(): Promise<CapabilityReport> {
  const codexExecutable = await resolveCodexExecutable();
  const { stdout: versionOutput } = await execFileAsync(codexExecutable, ["--version"], {
    cwd: projectRoot,
    windowsHide: true,
  });

  const { appServerUserAgent, codexHome, installedSkills } = await (async () => {
    const realClient = new AppServerClient({ cwd: projectRoot, executablePath: codexExecutable });
    try {
      const initialized = await realClient.start();
      return {
        appServerUserAgent: initialized.userAgent,
        codexHome: initialized.codexHome,
        installedSkills: flattenSkills(await realClient.listSkills([projectRoot], true)),
      };
    } finally {
      realClient.close();
    }
  })();

  const isolatedHome = await mkdtemp(join(tmpdir(), "personal-workbench-codex-home-"));
  const isolatedClient = new AppServerClient({
    cwd: projectRoot,
    executablePath: codexExecutable,
    env: { ...process.env, CODEX_HOME: isolatedHome },
  });
  let fixtureSkill: SkillMetadata | undefined;
  let originalEnabled: boolean | undefined;
  let restored = false;
  let operationError: Error | undefined;
  let restorationError: Error | undefined;
  let cleanupError: Error | undefined;
  try {
    await isolatedClient.start();
    await isolatedClient.setExtraSkillRoots([fixtureRoot]);
    const skills = flattenSkills(await isolatedClient.listSkills([projectRoot], true));
    fixtureSkill = skills.find((skill) => skill.name === fixtureName);
    if (!fixtureSkill) throw new Error(`Fixture Skill was not discovered from ${fixtureRoot}`);

    originalEnabled = fixtureSkill.enabled;
    const toggled = await isolatedClient.writeSkillConfig(fixtureSkill.path, !originalEnabled);
    if (toggled.effectiveEnabled === originalEnabled) {
      throw new Error("skills/config/write did not change the fixture's effective state");
    }
  } catch (error) {
    operationError = asError(error);
  } finally {
    if (fixtureSkill && originalEnabled !== undefined) {
      try {
        const restoration = await isolatedClient.writeSkillConfig(
          fixtureSkill.path,
          originalEnabled,
        );
        restored = restoration.effectiveEnabled === originalEnabled;
      } catch (error) {
        restorationError = new Error(
          `Fixture Skill state restoration failed inside isolated CODEX_HOME ${isolatedHome}; the real user configuration was not used. Cause: ${String(error)}`,
        );
      }
    }
    isolatedClient.close();
    try {
      await rm(isolatedHome, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    } catch (error) {
      cleanupError = asError(error);
    }
  }
  const isolatedFailures = [operationError, restorationError, cleanupError].filter(
    (error): error is Error => error !== undefined,
  );
  if (isolatedFailures.length > 0) {
    throw new AggregateError(isolatedFailures, "Isolated Skill capability verification failed");
  }
  if (!restored || !fixtureSkill) throw new Error("Fixture Skill state was not restored");

  return {
    codexVersion: versionOutput.trim(),
    codexExecutable,
    appServerUserAgent,
    codexHome,
    installedSkillCount: installedSkills.length,
    installedSkillNames: installedSkills
      .map((skill) => skill.name)
      .sort()
      .slice(0, 20),
    fixtureSkillPath: fixtureSkill.path,
    fixtureToggleRestored: restored,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyCodexCapabilities()
    .then((report) => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(
        `Codex capability verification failed: ${error instanceof Error ? error.stack : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
