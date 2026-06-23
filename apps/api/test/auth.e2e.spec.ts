import { type INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthModule } from "../src/auth/auth.module";
import { AUTH_USER_STORE, InMemoryAuthUserStore } from "../src/auth/user-store";
import { validateEnv } from "../src/config/env.schema";
import { PrismaService } from "../src/prisma/prisma.service";

const completeEnv = {
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

  it("logs in with mock provider, sets a secure HttpOnly cookie, and returns /api/me", async () => {
    const login = await fetch(`${baseUrl}/auth/login?provider=mock`, { redirect: "manual" });
    expect(login.status).toBe(302);
    const loginLocation = login.headers.get("location");
    expect(loginLocation).toContain("/auth/callback?provider=mock");

    const callback = await fetch(new URL(loginLocation!, baseUrl), { redirect: "manual" });
    expect(callback.status).toBe(302);
    const setCookie = callback.headers.get("set-cookie");
    expect(setCookie).toContain("pas_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=604800");

    const cookie = setCookie!.split(";")[0]!;
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    await expect(me.json()).resolves.toMatchObject({
      idpProvider: "mock",
      idpUserId: "mock-user-1",
      name: "Mock 售前",
      email: "mock.presales@example.com",
    });
  });

  it("returns 401 for protected routes without a cookie", async () => {
    const me = await fetch(`${baseUrl}/api/me`);
    expect(me.status).toBe(401);
  });
});
