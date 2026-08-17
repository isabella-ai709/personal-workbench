import { resolve } from "node:path";

export interface ServerConfig {
  host: string;
  port: number;
  databasePath: string;
  logsDirectory: string;
  workingDirectory: string;
}

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const workingDirectory = resolve(environment.WORKBENCH_WORKING_DIRECTORY ?? process.cwd());
  return {
    host: environment.WORKBENCH_HOST ?? "127.0.0.1",
    port: Number(environment.WORKBENCH_PORT ?? 4310),
    databasePath: resolve(environment.WORKBENCH_DATABASE_PATH ?? "data/workbench.sqlite"),
    logsDirectory: resolve(environment.WORKBENCH_LOGS_DIRECTORY ?? "logs"),
    workingDirectory,
  };
}
