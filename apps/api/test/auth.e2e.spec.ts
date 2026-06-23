import { type INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthModule } from "../src/auth/auth.module";
import { OAUTH_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "../src/auth/types";
import { AUTH_USER_STORE, InMemoryAuthUserStore } from "../src/auth/user-store";
import { validateEnv } from "../src/config/env.schema";
import { PrismaService } from "../src/prisma/prisma.service";

const completeEnv = {
  APP_BASE_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://pas:pas@localhost:5544/pas",
  CRM_API_KEY: "test-crm-key",
  CRM_BASE_URL: "https://crm.example.com/api",
  CRM_PROVIDER: "external",
  FEISHU_APP_ID: "cli_test",
  FEISHU_APP_SECRET: "test-feishu-secret",
  FEISHU_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=feishu",
  IDP_MODE: "mock",
  JWT_SECRET: "test-secret-at-least-32-characters-long",
  LLM_API_KEY: "test-llm-key",
  LLM_BASE_URL: "https://llm.example.com/v1",
  LLM_CLIENT_MODE: "mock",
  LLM_MODEL: "test-model",
  MINIO_ACCESS_KEY: "pas",
  MINIO_BUCKET: "pas-dev",
  MINIO_ENDPOINT: "http://localhost:9900",
  MINIO_SECRET_KEY: "test-minio-secret",
  NODE_ENV: "test",
  RAGFLOW_API_KEY: "test-ragflow-key",
  RAGFLOW_BASE_URL: "http://localhost:9380",
  RAGFLOW_CLIENT_MODE: "mock",
  REDIS_URL: "redis://localhost:6399",
  WECOM_AGENT_ID: "1000002",
  WECOM_APP_SECRET: "test-wecom-secret",
  WECOM_CORP_ID: "ww_test",
  WECOM_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=wecom",
};

function cookieValue(setCookie: string, name: string): string {
  const pair = setCookie
    .split(/,\s*/)
    .flatMap((part) => part.split(";"))
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) throw new Error(`Missing cookie ${name}`);
  return decodeURIComponent(pair.slice(name.length + 1));
}

describe("Auth mock IdP flow", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          validate: validateEnv,
        }),
        AuthModule,
      ],
    })
      .overrideProvider(AUTH_USER_STORE)
      .useValue(new InMemoryAuthUserStore())
      .overrideProvider(PrismaService)
      .useValue({ onModuleInit: async () => undefined, onModuleDestroy: async () => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("logs in with mock provider, validates OAuth state, sets a dev session cookie, and returns /api/me", async () => {
    const login = await fetch(`${baseUrl}/auth/login?provider=mock`, {
      headers: { host: "evil.example" },
      redirect: "manual",
    });
    expect(login.status).toBe(302);
    const loginLocation = login.headers.get("location");
    expect(loginLocation).toContain("http://localhost:3001/auth/callback?provider=mock");

    const loginSetCookie = login.headers.get("set-cookie") ?? "";
    expect(loginSetCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
    expect(loginSetCookie).toContain("HttpOnly");
    expect(loginSetCookie).toContain("SameSite=Lax");
    expect(loginSetCookie).toContain("Max-Age=300");
    expect(loginSetCookie).not.toContain("Secure");

    const state = new URL(loginLocation!).searchParams.get("state");
    expect(cookieValue(loginSetCookie, OAUTH_STATE_COOKIE_NAME)).toBe(state);

    const callbackLocation = new URL(loginLocation!);
    const callback = await fetch(`${baseUrl}${callbackLocation.pathname}${callbackLocation.search}`, {
      headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${state}` },
      redirect: "manual",
    });
    expect(callback.status).toBe(302);
    const callbackSetCookie = callback.headers.get("set-cookie") ?? "";
    expect(callbackSetCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(callbackSetCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
    expect(callbackSetCookie).toContain("Max-Age=0");
    expect(callbackSetCookie).toContain("HttpOnly");
    expect(callbackSetCookie).toContain("SameSite=Lax");
    expect(callbackSetCookie).not.toContain("Secure");
    expect(callbackSetCookie).toContain("Max-Age=604800");

    const cookie = `${SESSION_COOKIE_NAME}=${cookieValue(callbackSetCookie, SESSION_COOKIE_NAME)}`;
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    await expect(me.json()).resolves.toMatchObject({
      idpProvider: "mock",
      idpUserId: "mock-user-1",
      name: "Mock 售前",
      email: "mock.presales@example.com",
    });
  });

  it("returns 400 and expires state when callback state is missing", async () => {
    const callback = await fetch(
      `${baseUrl}/auth/callback?provider=mock&code=mock-user-1&state=forged`,
      { redirect: "manual" },
    );

    expect(callback.status).toBe(400);
    const setCookie = callback.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 400 and expires state when callback state does not match the cookie", async () => {
    const callback = await fetch(
      `${baseUrl}/auth/callback?provider=mock&code=mock-user-1&state=received-state`,
      {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=expected-state` },
        redirect: "manual",
      },
    );

    expect(callback.status).toBe(400);
    const setCookie = callback.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 401 for protected routes without a cookie", async () => {
    const me = await fetch(`${baseUrl}/api/me`);
    expect(me.status).toBe(401);
  });
});
