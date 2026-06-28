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

describe("feedback dashboard admin route", () => {
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
        message: {
          count: vi.fn().mockResolvedValue(6),
        },
        conversationFeedback: {
          count: vi.fn(async ({ where }: { where: { rating?: "up" | "down" } }) =>
            where.rating === "up" ? 3 : 2,
          ),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([{ count: 1 }])
          .mockResolvedValueOnce([{ query: "How should encryption be configured?", downCount: 2 }])
          .mockResolvedValueOnce([{ date: "2026-06-01", count: 6 }]),
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

  it("allows admins to read the aggregate dashboard", async () => {
    const token = jwt.sign(session({ uid: "admin-1", role: "admin", isExternal: false }));

    const response = await fetch(
      `${baseUrl}/api/internal/admin/feedback-dashboard?from=2026-06-01T00:00:00.000Z&to=2026-06-01T23:59:59.999Z`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-01T23:59:59.999Z",
      },
      totals: {
        qaCount: 6,
        upCount: 3,
        downCount: 2,
        refusalCount: 1,
      },
      rates: {
        upRate: 0.5,
        downRate: 0.3333,
        refusalRate: 0.1667,
      },
      topDownQueries: [{ query: "How should encryption be configured?", downCount: 2 }],
      dailyUsage: [{ date: "2026-06-01", count: 6 }],
    });
  });

  it("rejects presales users", async () => {
    const token = jwt.sign(session({ role: "presales", isExternal: false }));

    const response = await fetch(`${baseUrl}/api/internal/admin/feedback-dashboard`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(response.status).toBe(403);
  });

  it("rejects external users before role access", async () => {
    const token = jwt.sign(session({ uid: "external-1", role: "external", isExternal: true }));

    const response = await fetch(`${baseUrl}/api/internal/admin/feedback-dashboard`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(response.status).toBe(403);
  });
});
