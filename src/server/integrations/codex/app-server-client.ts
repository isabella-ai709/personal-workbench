import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type SkillScope = "user" | "repo" | "system" | "admin";

export interface SkillMetadata {
  name: string;
  description: string;
  shortDescription?: string;
  path: string;
  scope: SkillScope;
  enabled: boolean;
}

export interface SkillsListEntry {
  cwd: string;
  skills: SkillMetadata[];
  errors: Array<{ path: string; message: string }>;
}

export interface SkillsListResponse {
  data: SkillsListEntry[];
}

export interface InitializeResponse {
  userAgent: string;
  codexHome: string;
  platformFamily: string;
  platformOs: string;
}

type JsonObject = Record<string, unknown>;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface AppServerProcess extends NodeJS.EventEmitter {
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(): boolean;
  killed?: boolean;
}

export type SpawnAppServer = (
  executablePath: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; windowsHide: boolean },
) => AppServerProcess;

export interface AppServerClientOptions {
  cwd: string;
  executablePath?: string;
  env?: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
  spawnProcess?: SpawnAppServer;
}

const defaultSpawn: SpawnAppServer = (executablePath, args, options) =>
  spawn(executablePath, args, {
    ...options,
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;

export async function resolveCodexExecutable(explicitPath?: string): Promise<string> {
  const configuredPath = explicitPath ?? process.env.WORKBENCH_CODEX_PATH;
  if (configuredPath) {
    await access(configuredPath, constants.X_OK);
    return configuredPath;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const binRoot = join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const directories = await readdir(binRoot, { withFileTypes: true });
      const candidates = await Promise.all(
        directories
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const candidate = join(binRoot, entry.name, "codex.exe");
            try {
              const details = await stat(candidate);
              return details.isFile() ? { path: candidate, modified: details.mtimeMs } : null;
            } catch {
              return null;
            }
          }),
      );
      const newest = candidates
        .filter((candidate): candidate is { path: string; modified: number } => candidate !== null)
        .sort((left, right) => right.modified - left.modified)[0];
      if (newest) return newest.path;
    } catch {
      // Fall through to PATH. Spawn will report an actionable error if it is unavailable.
    }
  }

  return process.platform === "win32" ? "codex.exe" : "codex";
}

export class AppServerClient {
  private readonly options: AppServerClientOptions;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly stderrTail: string[] = [];
  private process: AppServerProcess | null = null;
  private nextId = 1;
  private closing = false;

  constructor(options: AppServerClientOptions) {
    this.options = options;
  }

  async start(): Promise<InitializeResponse> {
    if (this.process) throw new Error("Codex App Server client is already started");

    const executablePath = await resolveCodexExecutable(this.options.executablePath);
    const spawnProcess = this.options.spawnProcess ?? defaultSpawn;
    this.process = spawnProcess(executablePath, ["app-server", "--stdio"], {
      cwd: this.options.cwd,
      env: this.options.env ?? process.env,
      windowsHide: true,
    });

    const lines = createInterface({ input: this.process.stdout });
    lines.on("line", (line) => this.handleLine(line));
    this.process.stderr.on("data", (chunk) => this.captureStderr(String(chunk)));
    this.process.once("error", (error) =>
      this.handleExit(new Error(`Codex App Server failed: ${error.message}`)),
    );
    this.process.once("exit", (code, signal) => {
      if (!this.closing) {
        const suffix = this.stderrTail.length > 0 ? `: ${this.stderrTail.join(" ")}` : "";
        this.handleExit(
          new Error(
            `Codex App Server exited unexpectedly (code=${String(code)}, signal=${String(signal)})${suffix}`,
          ),
        );
      }
    });

    const result = await this.request<InitializeResponse>("initialize", {
      clientInfo: {
        name: "personal-codex-workbench",
        title: "Personal Codex Workbench",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });
    this.notify("initialized");
    return result;
  }

  request<T>(method: string, params?: JsonObject): Promise<T> {
    if (!this.process) return Promise.reject(new Error("Codex App Server client is not started"));

    const id = this.nextId++;
    const timeoutMs = this.options.requestTimeoutMs ?? 15_000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        this.write({ method, id, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  notify(method: string, params?: JsonObject): void {
    this.write(params === undefined ? { method } : { method, params });
  }

  listSkills(cwds: string[], forceReload = false): Promise<SkillsListResponse> {
    return this.request("skills/list", { cwds, forceReload });
  }

  setExtraSkillRoots(extraRoots: string[]): Promise<Record<string, never>> {
    return this.request("skills/extraRoots/set", { extraRoots });
  }

  writeSkillConfig(path: string, enabled: boolean): Promise<{ effectiveEnabled: boolean }> {
    return this.request("skills/config/write", { path, enabled });
  }

  close(): void {
    if (!this.process) return;
    this.closing = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Codex App Server client closed"));
    }
    this.pending.clear();
    this.process.kill();
    this.process = null;
  }

  private write(message: JsonObject): void {
    if (!this.process) throw new Error("Codex App Server client is not started");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonObject;
    try {
      message = JSON.parse(line) as JsonObject;
    } catch {
      this.handleExit(new Error(`Codex App Server returned invalid JSON: ${line.slice(0, 160)}`));
      return;
    }

    if (
      (typeof message.id === "number" || typeof message.id === "string") &&
      !("method" in message)
    ) {
      const id = Number(message.id);
      const pending = this.pending.get(id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      if (message.error && typeof message.error === "object") {
        const rpcError = message.error as { code?: number; message?: string };
        pending.reject(
          new Error(
            `Codex App Server error ${String(rpcError.code)}: ${rpcError.message ?? "unknown error"}`,
          ),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if ("method" in message && "id" in message) {
      this.write({
        id: message.id,
        error: { code: -32601, message: `Client method not supported: ${String(message.method)}` },
      });
    }
  }

  private captureStderr(text: string): void {
    this.stderrTail.push(...text.split(/\r?\n/).filter(Boolean));
    if (this.stderrTail.length > 12) this.stderrTail.splice(0, this.stderrTail.length - 12);
  }

  private handleExit(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
