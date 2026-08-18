import { Codex, type ThreadOptions } from "@openai/codex-sdk";
import { z } from "zod";

import {
  businessAiDraftSchema,
  createActivityInputSchema,
  createFollowUpInputSchema,
} from "../../../shared/business-contracts";
import { WorkbenchError } from "../../../shared/errors";
import { resolveCodexExecutable } from "../../integrations/codex/app-server-client";
import { redactText } from "../../integrations/codex/redact";
import { BusinessRepository } from "./business-repository";

const extractionSchema = businessAiDraftSchema.pick({
  summary: true,
  needs: true,
  facts: true,
  risks: true,
  nextActions: true,
});
type Extraction = z.infer<typeof extractionSchema>;

export interface BusinessAiExtractor {
  extract(content: string): Promise<Extraction>;
}

interface ThreadLike {
  run(input: string, options?: { signal?: AbortSignal }): Promise<{ finalResponse: string }>;
}
interface ClientLike {
  startThread(options?: ThreadOptions): ThreadLike;
}

export interface CodexBusinessAiExtractorOptions {
  workingDirectory: string;
  codexPath?: string;
  timeoutMs?: number;
  environment?: NodeJS.ProcessEnv;
  createClient?: (executablePath: string) => ClientLike;
}

export class CodexBusinessAiExtractor implements BusinessAiExtractor {
  constructor(private readonly options: CodexBusinessAiExtractorOptions) {}

  async extract(content: string): Promise<Extraction> {
    const executablePath = await resolveCodexExecutable(this.options.codexPath);
    const client = this.options.createClient
      ? this.options.createClient(executablePath)
      : new Codex({ codexPathOverride: executablePath });
    const thread = client.startThread({
      workingDirectory: this.options.workingDirectory,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 120_000);
    try {
      const safeContent = redactText(content, this.options.environment);
      const prompt = `你是本机商务工作台的信息整理器。只根据原文提取信息，不补造姓名、金额、日期或承诺。
只返回 JSON，不要代码块或解释。格式：
{"summary":"沟通摘要","needs":["需求"],"facts":["已确认事实或承诺"],"risks":["风险、异议或待确认问题"],"nextActions":[{"title":"下一步行动","dueAt":"带时区的 ISO 时间或 null"}]}
没有内容的数组返回 []。原文如下：
${safeContent}`;
      const response = await thread.run(prompt, { signal: controller.signal });
      const json = response.finalResponse
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      return extractionSchema.parse(JSON.parse(json));
    } catch (error) {
      if (controller.signal.aborted) {
        throw new WorkbenchError("TIMEOUT", "AI 整理超时，请稍后重试", 504);
      }
      if (error instanceof WorkbenchError) throw error;
      throw new WorkbenchError("UNAVAILABLE", "AI 整理暂时不可用，仍可手动记录商务活动", 503);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class BusinessAiService {
  constructor(
    private readonly repository: BusinessRepository,
    private readonly extractor: BusinessAiExtractor,
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async generate(rawContent: string) {
    const content = z.string().trim().min(1).max(40_000).parse(rawContent);
    const safeContent = redactText(content, this.environment);
    const extraction = await this.extractor.extract(safeContent);
    return this.repository.createAiDraft(
      {
        ...extraction,
        summary: redactText(extraction.summary, this.environment),
        needs: extraction.needs.map((item) => redactText(item, this.environment)),
        facts: extraction.facts.map((item) => redactText(item, this.environment)),
        risks: extraction.risks.map((item) => redactText(item, this.environment)),
        nextActions: extraction.nextActions.map((item) => ({
          ...item,
          title: redactText(item.title, this.environment),
        })),
      },
      safeContent,
    );
  }

  get(id: string) {
    return this.repository.getAiDraft(id);
  }

  confirm(id: string, payload: unknown, idempotencyKey: string) {
    const body = z
      .object({
        activity: createActivityInputSchema,
        followUps: z.array(createFollowUpInputSchema).max(20).default([]),
      })
      .parse(payload);
    return this.repository.confirmAiDraft(id, body.activity, body.followUps, idempotencyKey);
  }
}
