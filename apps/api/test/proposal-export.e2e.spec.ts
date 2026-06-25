import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import JSZip from "jszip";
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

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    customerRef: "华义匀安",
    opportunityRef: null,
    title: "终端 DLP 方案",
    status: "final",
    requirementJson: { customer: "华义匀安" },
    contentJson: {
      sections: [
        {
          id: "background",
          title: "项目背景",
          body: "客户需要部署端点 DLP。",
          refs: [],
        },
        {
          id: "solution",
          title: "解决方案",
          body: "推荐 IP-Guard 标准版 [1]。",
          refs: [
            { n: 1, chunkId: "c-1", docName: "white-paper.pdf", page: 7 },
          ],
        },
      ],
    },
    pptFileKey: null,
    createdBy: "user-1",
    version: 2,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("proposal export API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let authCookie: string;
  let proposalFindFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    proposalFindFirst = vi.fn().mockResolvedValue(proposalRow());

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        proposal: {
          findFirst: proposalFindFirst,
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    authCookie = `${SESSION_COOKIE_NAME}=${new JwtSessionService(
      completeEnv.JWT_SECRET,
      604_800,
    ).sign(session())}`;
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("rejects export without a valid format", async () => {
    const response = await request("/api/internal/proposals/proposal-1/export");
    expect(response.status).toBe(400);
    expect(proposalFindFirst).not.toHaveBeenCalled();
  });

  it("rejects export with unsupported format", async () => {
    const response = await request(
      "/api/internal/proposals/proposal-1/export?format=pdf",
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for soft-deleted proposals", async () => {
    proposalFindFirst.mockResolvedValueOnce(null);
    const response = await request(
      "/api/internal/proposals/proposal-1/export?format=md",
    );
    expect(response.status).toBe(404);
  });

  it("returns 403 when the proposal belongs to another user", async () => {
    proposalFindFirst.mockResolvedValueOnce(proposalRow({ createdBy: "user-2" }));
    const response = await request(
      "/api/internal/proposals/proposal-1/export?format=md",
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 when content has not been generated yet", async () => {
    proposalFindFirst.mockResolvedValueOnce(proposalRow({ contentJson: null }));
    const response = await request(
      "/api/internal/proposals/proposal-1/export?format=docx",
    );
    expect(response.status).toBe(400);
  });

  it("streams markdown with RFC 5987 filename encoding and chapter content", async () => {
    const response = await request(
      "/api/internal/proposals/proposal-1/export?format=md",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/markdown/);
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/attachment; filename\*=UTF-8''/);
    expect(disposition).toContain(
      encodeURIComponent("华义匀安-终端 DLP 方案-v2.md"),
    );
    const body = await response.text();
    expect(body).toContain("# 终端 DLP 方案");
    expect(body).toContain("> 客户：华义匀安 ｜ 版本：v2");
    expect(body).toContain("## 解决方案");
    expect(body).toContain("[1] white-paper.pdf, page 7");
  });

  it("streams a docx file that parses back to expected chapters", async () => {
    const response = await request(
      "/api/internal/proposals/proposal-1/export?format=docx",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toContain(
      encodeURIComponent("华义匀安-终端 DLP 方案-v2.docx"),
    );

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("终端 DLP 方案");
    expect(xml).toContain("项目背景");
    expect(xml).toContain("解决方案");
    expect(xml).toContain("[1] white-paper.pdf, page 7");
  });

  function request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        cookie: authCookie,
        ...init.headers,
      },
    });
  }
});
