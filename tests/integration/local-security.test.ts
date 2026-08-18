import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app";
import { isLoopbackHost, loadServerConfig, serverOrigin } from "../../src/server/config";
import type { TaskPlanService } from "../../src/server/modules/task-plans/task-plan-service";
import { LocalSession } from "../../src/server/security/local-session";

const origin = "http://127.0.0.1:4310";
const token = "test-session-token-with-enough-entropy";
const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function setup() {
  const taskPlanService = {
    create: () => ({ id: "task-created" }),
  } as unknown as TaskPlanService;
  const app = buildApp(taskPlanService, undefined, new LocalSession({ origin, token }));
  apps.push(app);
  return app;
}

describe("localhost security", () => {
  it("accepts only explicit loopback bind addresses and valid ports", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(() => loadServerConfig({ WORKBENCH_HOST: "0.0.0.0" })).toThrow("loopback");
    expect(() => loadServerConfig({ WORKBENCH_PORT: "70000" })).toThrow("between 1 and 65535");
    expect(serverOrigin({ host: "::1", port: 4310 })).toBe("http://[::1]:4310");
  });

  it("issues the startup token only to local or same-origin reads", async () => {
    const app = setup();
    const response = await app.inject({ method: "GET", url: "/api/session" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ token });
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(response.headers["content-security-policy"]).toContain(
      "style-src 'self' 'unsafe-inline'",
    );

    const crossOrigin = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { origin: "https://attacker.example" },
    });
    expect(crossOrigin.statusCode).toBe(403);
  });

  it("requires same-origin JSON and the session token for every mutation", async () => {
    const app = setup();
    const request = (headers: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: "/api/task-plans",
        headers,
        payload: {
          title: "test",
        },
      });

    expect((await request({ "content-type": "application/json" })).statusCode).toBe(403);
    expect((await request({ origin, "content-type": "application/json" })).statusCode).toBe(403);
    expect(
      (
        await request({
          origin,
          "content-type": "text/plain",
          "x-workbench-session": token,
        })
      ).statusCode,
    ).toBe(415);
    expect(
      (
        await request({
          origin: "https://attacker.example",
          "content-type": "application/json",
          "x-workbench-session": token,
        })
      ).statusCode,
    ).toBe(403);

    const valid = await request({
      origin,
      "content-type": "application/json; charset=utf-8",
      "x-workbench-session": token,
    });
    expect(valid.statusCode).toBe(201);
    expect(valid.json()).toEqual({ id: "task-created" });
  });

  it("does not disclose stack traces or local paths for unexpected failures", async () => {
    const app = setup();
    app.get("/api/test-failure", async () => {
      throw new Error("secret failure at D:\\private\\workbench.env");
    });
    const response = await app.inject({ method: "GET", url: "/api/test-failure" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The workbench could not complete this request.",
      },
    });
    expect(response.body).not.toContain("private");
    expect(response.body).not.toContain("stack");
  });
});
