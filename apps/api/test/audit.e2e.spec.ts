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

describe("audit logging", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  let auditLogCreate: ReturnType<typeof vi.fn>;
  let auditLogFindMany: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }
    auditLogCreate = vi.fn().mockResolvedValue({});
    auditLogFindMany = vi.fn().mockResolvedValue([
      {
        id: "audit-1",
        userId: "external-1",
        action: "GET",
        resource: "/api/internal/admin/ping",
        isExternal: true,
        detailJson: { result: "forbidden_external_internal" },
        createdAt: new Date("2026-06-23T12:00:00.000Z"),
      },
    ]);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: vi.fn().mockResolvedValue([{ ragflow_doc_id: "mock-document" }]),
        auditLog: {
          create: auditLogCreate,
          findMany: auditLogFindMany,
        },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("writes an AuditLog and console warning when external users hit internal routes", async () => {
    const token = jwt.sign(session({ uid: "external-1", role: "external", isExternal: true }));

    const response = await fetch(`${baseUrl}/api/internal/admin/ping`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(response.status).toBe(403);
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "external-1",
        action: "GET",
        resource: "/api/internal/admin/ping",
        isExternal: true,
        detailJson: expect.objectContaining({ result: "forbidden_external_internal" }),
      }),
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("External internal route access denied"),
      expect.objectContaining({ userId: "external-1", resource: "/api/internal/admin/ping" }),
    );
  });

  it("allows admins to query AuditLog records with userId/from/to filters", async () => {
    const token = jwt.sign(session({ uid: "admin-1", role: "admin", isExternal: false }));

    const response = await fetch(
      `${baseUrl}/api/internal/admin/audit-logs?userId=external-1&from=2026-06-23T00:00:00.000Z&to=2026-06-24T00:00:00.000Z`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "audit-1",
        userId: "external-1",
        action: "GET",
        resource: "/api/internal/admin/ping",
        isExternal: true,
        detailJson: { result: "forbidden_external_internal" },
        createdAt: "2026-06-23T12:00:00.000Z",
      },
    ]);
    expect(auditLogFindMany).toHaveBeenCalledWith({
      where: {
        userId: "external-1",
        createdAt: {
          gte: new Date("2026-06-23T00:00:00.000Z"),
          lte: new Date("2026-06-24T00:00:00.000Z"),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
});
