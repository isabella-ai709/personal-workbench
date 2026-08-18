import { resolve } from "node:path";

export interface ServerConfig {
  host: string;
  port: number;
  databasePath: string;
  workingDirectory: string;
}

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const workingDirectory = resolve(environment.WORKBENCH_WORKING_DIRECTORY ?? process.cwd());
  const host = environment.WORKBENCH_HOST ?? "127.0.0.1";
  const port = Number(environment.WORKBENCH_PORT ?? 4310);
  if (!isLoopbackHost(host)) {
    throw new Error("WORKBENCH_HOST must be a loopback address");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("WORKBENCH_PORT must be an integer between 1 and 65535");
  }
  return {
    host,
    port,
    databasePath: resolve(environment.WORKBENCH_DATABASE_PATH ?? "data/workbench.sqlite"),
    workingDirectory,
  };
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function serverOrigin(config: Pick<ServerConfig, "host" | "port">): string {
  const host = config.host.includes(":") ? `[${config.host.replace(/^\[|\]$/g, "")}]` : config.host;
  return `http://${host}:${config.port}`;
}
