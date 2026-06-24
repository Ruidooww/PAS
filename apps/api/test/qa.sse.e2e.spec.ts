import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Chunk } from "@pas/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmClient } from "../src/clients/llm";
import type { RagflowClient } from "../src/clients/ragflow";
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

const chunks: Chunk[] = [
  {
    id: "chunk-1",
    documentId: "doc-1",
    content: "控制台路径：策略中心 > 加密策略 > 新建策略。",
    score: 0.95,
    metadata: { docName: "Web控制台说明.pdf", page: 24 },
  },
];

function session(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    uid: "mock-user-1",
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

function parseSse(text: string): unknown[] {
  return text
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter(Boolean)
    .map((frame) => {
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);
      if (!data) throw new Error(`Missing data frame in ${frame}`);
      return JSON.parse(data);
    });
}

describe("internal QA SSE", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  let retrieve: ReturnType<typeof vi.fn>;
  let stream: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) vi.stubEnv(key, value);
    retrieve = vi.fn().mockResolvedValue(chunks);
    stream = vi.fn(async function* () {
      yield "先进入策略中心";
      yield "，再新建加密策略 [1]";
    });
    const conversations = new Map<string, { id: string; sessionId: string }>();
    const messages = new Map<string, Array<{ role: string; content: string; createdAt: Date }>>();

    const { AppModule } = await import("../src/app.module");
    const { LLM_CLIENT, RAGFLOW_CLIENT } = await import("../src/clients");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RAGFLOW_CLIENT)
      .useValue({
        retrieve,
        chat: vi.fn(),
        graphQuery: vi.fn(),
        listDocs: vi.fn(),
        uploadDoc: vi.fn(),
      } as unknown as RagflowClient)
      .overrideProvider(LLM_CLIENT)
      .useValue({ complete: vi.fn(), stream } as unknown as LlmClient)
      .overrideProvider(PrismaService)
      .useValue({
        conversation: {
          upsert: vi.fn(
            ({
              where,
              create,
            }: {
              where: { sessionId_userId: { sessionId: string; userId: string } };
              create: { sessionId: string; userId: string };
            }) => {
              const key = `${where.sessionId_userId.userId}:${where.sessionId_userId.sessionId}`;
              const existing = conversations.get(key);
              if (existing) return Promise.resolve(existing);
              const conversation = { id: `conversation-${conversations.size + 1}`, ...create };
              conversations.set(key, conversation);
              messages.set(conversation.id, []);
              return Promise.resolve(conversation);
            },
          ),
        },
        message: {
          findMany: vi.fn(({ where }: { where: { conversationId: string } }) =>
            Promise.resolve([...(messages.get(where.conversationId) ?? [])].reverse()),
          ),
          create: vi.fn(
            ({
              data,
            }: {
              data: { conversationId: string; role: string; content: string; refs?: unknown };
            }) => {
              messages.get(data.conversationId)?.push({
                role: data.role,
                content: data.content,
                createdAt: new Date(messages.get(data.conversationId)?.length ?? 0),
              });
              return Promise.resolve({ id: `message-${Date.now()}`, ...data });
            },
          ),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("streams delta, refs, and done events for the gate query", async () => {
    const startedAt = Date.now();
    const token = jwt.sign(session());

    const response = await fetch(`${baseUrl}/api/internal/qa`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ query: "控制台加密策略怎么设置" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(Date.now() - startedAt).toBeLessThan(30_000);
    expect(parseSse(await response.text())).toEqual([
      { type: "session", sessionId: expect.any(String) },
      { type: "delta", content: "先进入策略中心" },
      { type: "delta", content: "，再新建加密策略 [1]" },
      { type: "refs", refs: [{ n: 1, docName: "Web控制台说明.pdf", page: 24 }] },
      { type: "done" },
    ]);
  });

  it("reads prior DB messages for follow-up questions in the same session", async () => {
    const token = jwt.sign(session());
    const headers = {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    await fetch(`${baseUrl}/api/internal/qa`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "控制台加密策略怎么设置", sessionId: "multi-turn" }),
    });
    await fetch(`${baseUrl}/api/internal/qa`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "延申一下", sessionId: "multi-turn" }),
    });

    expect(retrieve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("控制台加密策略怎么设置"),
      }),
    );
    expect(retrieve).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("延申一下"),
      }),
    );
  });

  it("returns 401 without authentication", async () => {
    const response = await fetch(`${baseUrl}/api/internal/qa`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "控制台加密策略怎么设置" }),
    });

    expect(response.status).toBe(401);
  });
});
