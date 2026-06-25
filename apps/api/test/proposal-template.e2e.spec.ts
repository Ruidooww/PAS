import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JwtSessionService } from "../src/auth/jwt-session.service";
import { SESSION_COOKIE_NAME, type SessionClaims } from "../src/auth/types";

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

function session(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    uid: "user-1",
    tenantId: "tenant-default",
    idpProvider: "mock",
    idpUserId: "mock-user-1",
    name: "Mock User",
    email: "mock.presales@example.com",
    role: "presales",
    isExternal: false,
    deptId: "dept-presales",
    ...overrides,
  };
}

describe("proposal template API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let authCookie: string;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    const jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    authCookie = `${SESSION_COOKIE_NAME}=${jwt.sign(session())}`;
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("lists the validated IP-Guard standard v1 template in chapter order", async () => {
    const response = await fetch(`${baseUrl}/api/internal/proposal-templates`, {
      headers: { cookie: authCookie },
    });

    expect(response.status).toBe(200);
    const templates = (await response.json()) as Array<Record<string, unknown>>;
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: "ip-guard-standard-v1",
      name: "IP-Guard 标准方案",
      version: 1,
      product: "IP-Guard",
    });

    const sections = templates[0]?.sections as Array<Record<string, unknown>>;
    expect(sections).toHaveLength(7);
    expect(sections.map((section) => section.title)).toEqual([
      "项目背景",
      "需求分析",
      "方案概述",
      "功能模块设计",
      "部署架构",
      "实施计划",
      "服务与支持",
    ]);
    for (const section of sections) {
      expect(section).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          retrievalIntent: expect.any(String),
          promptTemplate: expect.any(String),
          variables: expect.any(Array),
        }),
      );
      expect(section.retrievalIntent).not.toBe("");
      expect(section.promptTemplate).not.toBe("");
    }
    expect(sections[0]).toMatchObject({
      fixed: true,
      variables: ["customer", "industry"],
    });
    expect(sections[3]).toMatchObject({
      retrievalIntent: expect.stringContaining("{{need}}"),
      variables: ["requirementJson.needs[]"],
    });
    expect(sections[4]).toMatchObject({
      retrievalIntent: expect.stringContaining("{{scale}}"),
      variables: ["scale"],
    });
  });

  it("requires authentication", async () => {
    const response = await fetch(`${baseUrl}/api/internal/proposal-templates`);

    expect(response.status).toBe(401);
  });
});
