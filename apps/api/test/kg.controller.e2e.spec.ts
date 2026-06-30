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
  PAS_KB_ID: "proposal-kb",
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

describe("internal KG routes", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        auditLog: { create: vi.fn().mockResolvedValue({}) },
        kgEntityProduct: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "product-1",
              name: "IP-Guard",
              category: "DLP",
              vendor: "HYYA",
              aliases: ["ipg"],
              metadata: {},
            },
          ]),
          findUnique: vi.fn().mockResolvedValue({
            id: "product-1",
            name: "IP-Guard",
            category: "DLP",
            vendor: "HYYA",
            aliases: ["ipg"],
            metadata: {},
          }),
        },
        kgEntityCustomer: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        kgEntityIndustry: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        kgEntityProposal: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        kgRelation: { findMany: vi.fn().mockResolvedValue([]) },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 30_000);

  afterEach(async () => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("allows internal users to query KG entities", async () => {
    const response = await fetch(`${baseUrl}/api/internal/kg/entities?type=product&q=ip-guard`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${jwt.sign(session())}` },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        type: "product",
        id: "product-1",
        label: "IP-Guard",
        data: {
          category: "DLP",
          vendor: "HYYA",
          aliases: ["ipg"],
          metadata: {},
        },
      },
    ]);
  });

  it("rejects external users", async () => {
    const response = await fetch(`${baseUrl}/api/internal/kg/entities?type=product&q=ip-guard`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${jwt.sign(
          session({ role: "external", isExternal: true }),
        )}`,
      },
    });

    expect(response.status).toBe(403);
  });
});
