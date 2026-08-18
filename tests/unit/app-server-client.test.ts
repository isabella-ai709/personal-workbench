import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  AppServerClient,
  type AppServerProcess,
} from "../../src/server/integrations/codex/app-server-client";

class FakeProcess extends EventEmitter implements AppServerProcess {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;
  messages: Array<Record<string, unknown>> = [];

  constructor() {
    super();
    let buffered = "";
    this.stdin.on("data", (chunk) => {
      buffered += String(chunk);
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        const message = JSON.parse(line) as Record<string, unknown>;
        this.messages.push(message);
        if (message.method === "initialize") {
          this.respond(Number(message.id), {
            userAgent: "codex-test",
            codexHome: "C:\\tmp\\codex",
            platformFamily: "windows",
            platformOs: "windows",
          });
        }
      }
    });
  }

  respond(id: number, result: unknown): void {
    this.stdout.write(`${JSON.stringify({ id, result })}\n`);
  }

  fail(id: number, code: number, message: string): void {
    this.stdout.write(`${JSON.stringify({ id, error: { code, message } })}\n`);
  }

  kill(): boolean {
    this.killed = true;
    this.emit("exit", 0, null);
    return true;
  }
}

function createClient(fakeProcess: FakeProcess, requestTimeoutMs = 100): AppServerClient {
  return new AppServerClient({
    cwd: process.cwd(),
    executablePath: process.execPath,
    requestTimeoutMs,
    spawnProcess: () => fakeProcess,
  });
}

describe("AppServerClient", () => {
  it("performs the initialize handshake and sends initialized", async () => {
    const process = new FakeProcess();
    const client = createClient(process);

    const initialized = await client.start();

    expect(initialized.userAgent).toBe("codex-test");
    expect(process.messages.map((message) => message.method)).toEqual([
      "initialize",
      "initialized",
    ]);
    client.close();
  });

  it("matches responses by request id even when they arrive out of order", async () => {
    const process = new FakeProcess();
    const client = createClient(process);
    await client.start();

    const first = client.request<{ value: string }>("test/first", {});
    const second = client.request<{ value: string }>("test/second", {});
    const requests = process.messages.filter((message) =>
      String(message.method).startsWith("test/"),
    );
    process.respond(Number(requests[1]?.id), { value: "second" });
    process.respond(Number(requests[0]?.id), { value: "first" });

    await expect(first).resolves.toEqual({ value: "first" });
    await expect(second).resolves.toEqual({ value: "second" });
    client.close();
  });

  it("surfaces protocol errors", async () => {
    const process = new FakeProcess();
    const client = createClient(process);
    await client.start();

    const result = client.request("test/fail", {});
    const request = process.messages.find((message) => message.method === "test/fail");
    process.fail(Number(request?.id), -32602, "bad parameters");

    await expect(result).rejects.toThrow("bad parameters");
    client.close();
  });

  it("times out unanswered requests", async () => {
    const process = new FakeProcess();
    const client = createClient(process, 10);
    await client.start();

    await expect(client.request("test/timeout", {})).rejects.toThrow("timed out");
    client.close();
  });

  it("rejects pending requests after an unexpected process exit", async () => {
    const process = new FakeProcess();
    const client = createClient(process);
    await client.start();

    const result = client.request("test/pending", {});
    process.stderr.write("diagnostic detail\n");
    process.emit("exit", 2, null);

    await expect(result).rejects.toThrow("diagnostic detail");
  });
});
