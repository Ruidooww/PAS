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
  RAGFLOW_CLIENT_MODE: "real",
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

async function createApp(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...completeEnv, ...env })) {
    vi.stubEnv(key, value);
  }

  const kbSyncService = {
    runOnce: vi.fn().mockResolvedValue({
      runs: [
        { kbId: "proposal-kb", added: 2, deleted: 1, updated: 3, status: "success" },
      ],
    }),
  };

  const { AppModule } = await import("../src/app.module");
  const { KbSyncService } = await import("../src/internal/kb-sync/kb-sync.service");
  const { PrismaService } = await import("../src/prisma/prisma.service");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KbSyncService)
    .useValue(kbSyncService)
    .overrideProvider(PrismaService)
    .useValue({
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
    })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.listen(0);
  const jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
  return { app, baseUrl: await app.getUrl(), jwt, kbSyncService };
}

describe("internal KB sync run API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  let kbSyncService: { runOnce: ReturnType<typeof vi.fn> };
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const created = await createApp();
    app = created.app;
    baseUrl = created.baseUrl;
    jwt = created.jwt;
    kbSyncService = created.kbSyncService;
  }, 30_000);

  afterEach(async () => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("allows admins to trigger a manual sync run", async () => {
    const response = await request(session({ uid: "admin-1", role: "admin" }));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { ranAt: string };
    expect(body).toMatchObject({
      syncedDocs: 5,
      ragflowKbId: "proposal-kb",
    });
    expect(new Date(body.ranAt).toString()).not.toBe("Invalid Date");
    expect(kbSyncService.runOnce).toHaveBeenCalledWith({ throwOnFailure: true });
  });

  it("rejects presales users", async () => {
    const response = await request(session({ role: "presales" }));

    expect(response.status).toBe(403);
    expect(kbSyncService.runOnce).not.toHaveBeenCalled();
  });

  it("rejects external users", async () => {
    const response = await request(
      session({ uid: "external-1", role: "external", isExternal: true, deptId: null }),
    );

    expect(response.status).toBe(403);
    expect(kbSyncService.runOnce).not.toHaveBeenCalled();
  });

  function request(user: SessionClaims): Promise<Response> {
    return fetch(`${baseUrl}/api/internal/kb-sync/run`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${jwt.sign(user)}` },
    });
  }
});

describe("internal KB sync run API in mock RAGFlow mode", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  let kbSyncService: { runOnce: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const created = await createApp({ RAGFLOW_CLIENT_MODE: "mock" });
    app = created.app;
    baseUrl = created.baseUrl;
    jwt = created.jwt;
    kbSyncService = created.kbSyncService;
  }, 30_000);

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("returns a deterministic no-op response without calling sync", async () => {
    const response = await fetch(`${baseUrl}/api/internal/kb-sync/run`, {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${jwt.sign(session({ role: "admin" }))}`,
      },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { ranAt: string };
    expect(body).toMatchObject({
      syncedDocs: 0,
      ragflowKbId: "mock",
    });
    expect(new Date(body.ranAt).toString()).not.toBe("Invalid Date");
    expect(kbSyncService.runOnce).not.toHaveBeenCalled();
  });
});
