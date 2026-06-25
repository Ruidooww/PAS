import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { of } from "rxjs";
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

describe("proposal generation worker API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  const proposalFindUnique = vi.fn();
  const queueEnqueue = vi.fn();
  const progressStream = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    proposalFindUnique.mockReset();
    queueEnqueue.mockReset();
    progressStream.mockReset();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const { ProposalGenerationQueue } = await import(
      "../src/proposal-worker/proposal-generation.queue"
    );
    const { ProposalProgressService } = await import(
      "../src/proposal-worker/proposal-progress.service"
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProposalGenerationQueue)
      .useValue({
        enqueue: queueEnqueue.mockResolvedValue(undefined),
      })
      .overrideProvider(ProposalProgressService)
      .useValue({
        stream: progressStream,
      })
      .overrideProvider(PrismaService)
      .useValue({
        proposal: {
          findUnique: proposalFindUnique,
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
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
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("enqueues the proposal owner generation job", async () => {
    proposalFindUnique.mockResolvedValue({
      id: "proposal-1",
      createdBy: "user-1",
      requirementJson: {
        customer: "ABC",
        industry: "manufacturing",
        scale: "500",
        needs: ["document encryption"],
        constraints: [],
      },
    });

    const response = await fetch(`${baseUrl}/api/internal/proposals/proposal-1/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(session()),
      },
      body: JSON.stringify({ templateId: "ip-guard-standard-v1" }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      proposalId: "proposal-1",
      status: "queued",
    });
    expect(queueEnqueue).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      requirementJson: {
        customer: "ABC",
        industry: "manufacturing",
        scale: "500",
        needs: ["document encryption"],
        constraints: [],
      },
      templateId: "ip-guard-standard-v1",
      userId: "user-1",
    });
  });

  it("returns 400 instead of enqueueing when templateId is missing", async () => {
    proposalFindUnique.mockResolvedValue({
      id: "proposal-1",
      createdBy: "user-1",
      requirementJson: {},
    });

    const response = await fetch(`${baseUrl}/api/internal/proposals/proposal-1/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(session()),
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(queueEnqueue).not.toHaveBeenCalled();
  });

  it("returns 403 before opening SSE for a proposal owned by another user", async () => {
    proposalFindUnique.mockResolvedValue({
      id: "proposal-1",
      createdBy: "user-1",
    });

    const response = await fetch(`${baseUrl}/api/internal/proposals/proposal-1/progress`, {
      headers: {
        accept: "text/event-stream",
        cookie: authCookie(session({ uid: "user-2", idpUserId: "mock-user-2" })),
      },
    });

    expect(response.status).toBe(403);
    expect(progressStream).not.toHaveBeenCalled();
  });

  it("streams seven ordered chapter events and the final done event to the owner", async () => {
    proposalFindUnique.mockResolvedValue({
      id: "proposal-1",
      createdBy: "user-1",
    });
    const chapterEvents = Array.from({ length: 7 }, (_, index) => ({
      chapter: `chapter-${index + 1}`,
      n: index + 1,
      total: 7,
    }));
    progressStream.mockReturnValue(
      of(
        ...chapterEvents.map((data) => ({ data }) as MessageEvent),
        { data: { done: true } } as MessageEvent,
      ),
    );

    const response = await fetch(`${baseUrl}/api/internal/proposals/proposal-1/progress`, {
      headers: {
        accept: "text/event-stream",
        cookie: authCookie(session()),
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    for (const event of chapterEvents) {
      expect(body).toContain(`data: ${JSON.stringify(event)}`);
    }
    expect(body).toContain(`data: ${JSON.stringify({ done: true })}`);
  });

  function authCookie(claims: SessionClaims): string {
    return `${SESSION_COOKIE_NAME}=${jwt.sign(claims)}`;
  }
});
