import {
  AppServerClient,
  type AppServerClientOptions,
  type SkillMetadata,
} from "./app-server-client";

export interface SkillGateway {
  list(forceReload?: boolean): Promise<SkillMetadata[]>;
  setEnabled(path: string, enabled: boolean): Promise<boolean>;
}

export class CodexSkillGateway implements SkillGateway {
  constructor(private readonly options: AppServerClientOptions) {}

  async list(forceReload = false): Promise<SkillMetadata[]> {
    return this.withClient(async (client) => {
      const response = await client.listSkills([this.options.cwd], forceReload);
      const byPath = new Map<string, SkillMetadata>();
      for (const entry of response.data) {
        for (const skill of entry.skills) byPath.set(skill.path.toLowerCase(), skill);
      }
      return [...byPath.values()];
    });
  }

  async setEnabled(path: string, enabled: boolean): Promise<boolean> {
    return this.withClient(async (client) => {
      const response = await client.writeSkillConfig(path, enabled);
      return response.effectiveEnabled;
    });
  }

  private async withClient<T>(operation: (client: AppServerClient) => Promise<T>): Promise<T> {
    const client = new AppServerClient(this.options);
    try {
      await client.start();
      return await operation(client);
    } finally {
      client.close();
    }
  }
}
