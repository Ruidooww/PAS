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
  QA_KB_ID: "e0-mock-kb",
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

describe("internal KB documents API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let kbDocumentFindMany: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    kbDocumentFindMany = vi.fn().mockResolvedValue([
      {
        ragflowDocId: "rag-doc-1",
        name: "IP-Guard 终端管控白皮书",
        product: "IP-Guard",
        aclScope: "internal",
        sensitivity: "internal",
        chunkCount: 12,
        size: 1024,
        ragflowUpdatedAt: new Date("2026-06-20T08:00:00.000Z"),
        syncedAt: new Date("2026-06-21T08:00:00.000Z"),
      },
      {
        ragflowDocId: "rag-doc-2",
        name: "IP-Guard 外发管控方案",
        product: "IP-Guard",
        aclScope: "role:presales",
        sensitivity: "customer_sensitive",
        chunkCount: 8,
        size: 2048,
        ragflowUpdatedAt: null,
        syncedAt: new Date("2026-06-22T08:00:00.000Z"),
      },
      {
        ragflowDocId: "rag-doc-3",
        name: "DLP 行业案例",
        product: "DLP",
        aclScope: "internal",
        sensitivity: "internal",
        chunkCount: null,
        size: null,
        ragflowUpdatedAt: new Date("2026-06-23T08:00:00.000Z"),
        syncedAt: new Date("2026-06-24T08:00:00.000Z"),
      },
      {
        ragflowDocId: "rag-doc-blob",
        name: "6e3944cca0f156b44452876628cb843f.jpg",
        product: null,
        aclScope: "internal",
        sensitivity: "internal",
        chunkCount: 5,
        size: 4096,
        ragflowUpdatedAt: new Date("2026-06-25T08:00:00.000Z"),
        syncedAt: new Date("2026-06-25T08:00:00.000Z"),
      },
    ]);

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        kbDocument: { findMany: kbDocumentFindMany },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("returns mirrored KB documents with aggregate stats", async () => {
    const response = await fetch(`${baseUrl}/api/internal/kb-documents`, {
      headers: { cookie: authCookie() },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          ragflowDocId: "rag-doc-1",
          name: "IP-Guard 终端管控白皮书",
          product: "IP-Guard",
          aclScope: "internal",
          sensitivity: "internal",
          chunkCount: 12,
          size: 1024,
          ragflowUpdatedAt: "2026-06-20T08:00:00.000Z",
          syncedAt: "2026-06-21T08:00:00.000Z",
        },
        {
          ragflowDocId: "rag-doc-2",
          name: "IP-Guard 外发管控方案",
          product: "IP-Guard",
          aclScope: "role:presales",
          sensitivity: "customer_sensitive",
          chunkCount: 8,
          size: 2048,
          ragflowUpdatedAt: null,
          syncedAt: "2026-06-22T08:00:00.000Z",
        },
        {
          ragflowDocId: "rag-doc-3",
          name: "DLP 行业案例",
          product: "DLP",
          aclScope: "internal",
          sensitivity: "internal",
          chunkCount: null,
          size: null,
          ragflowUpdatedAt: "2026-06-23T08:00:00.000Z",
          syncedAt: "2026-06-24T08:00:00.000Z",
        },
      ],
      stats: {
        totalChunks: 20,
        totalDocs: 3,
        byType: {
          "IP-Guard": 2,
          DLP: 1,
        },
      },
    });
    expect(kbDocumentFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: [{ syncedAt: "desc" }, { name: "asc" }],
      select: {
        ragflowDocId: true,
        name: true,
        product: true,
        aclScope: true,
        sensitivity: true,
        chunkCount: true,
        size: true,
        ragflowUpdatedAt: true,
        syncedAt: true,
      },
    });
  });

  function authCookie(user: SessionClaims = session()): string {
    const token = new JwtSessionService(completeEnv.JWT_SECRET, 604_800).sign(user);
    return `${SESSION_COOKIE_NAME}=${token}`;
  }
});
