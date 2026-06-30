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
  CRM_PROVIDER: "mock",
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

describe("ACL audit API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  let aclAuditLogFindMany: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    aclAuditLogFindMany = vi.fn().mockResolvedValue([
      {
        id: "audit-1",
        userId: "user-1",
        resourceType: "customer",
        resourceId: "cust-acme",
        fieldName: "scale",
        chunkId: null,
        action: "field_read_filter",
        reason: "required_roles_denied",
        createdAt: new Date("2026-06-30T00:00:00.000Z"),
      },
    ]);

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        aclAuditLog: {
          findMany: aclAuditLogFindMany,
          create: vi.fn().mockResolvedValue({}),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
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
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("lets admin users query ACL audit logs by user/resource/time", async () => {
    const response = await request(
      "/api/internal/acl/audit?userId=user-1&resourceType=customer&from=2026-06-01T00:00:00.000Z&to=2026-07-01T00:00:00.000Z",
      session({ role: "admin" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "audit-1",
        userId: "user-1",
        resourceType: "customer",
        resourceId: "cust-acme",
        fieldName: "scale",
        chunkId: null,
        action: "field_read_filter",
        reason: "required_roles_denied",
        createdAt: "2026-06-30T00:00:00.000Z",
      },
    ]);
    expect(aclAuditLogFindMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        resourceType: "customer",
        createdAt: {
          gte: new Date("2026-06-01T00:00:00.000Z"),
          lte: new Date("2026-07-01T00:00:00.000Z"),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  it("rejects non-admin and non-compliance users", async () => {
    const response = await request("/api/internal/acl/audit", session({ role: "presales" }));

    expect(response.status).toBe(403);
    expect(aclAuditLogFindMany).not.toHaveBeenCalled();
  });

  function request(path: string, claims: SessionClaims): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${jwt.sign(claims)}`,
      },
    });
  }
});
