import { Logger, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
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

function stubCompleteEnv(overrides: Partial<typeof completeEnv> = {}) {
  for (const [key, value] of Object.entries({ ...completeEnv, ...overrides })) {
    vi.stubEnv(key, value);
  }
}

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
    customerRef: "customer-a",
    opportunityRef: null,
    title: "Customer A Proposal",
    status: "draft",
    requirementJson: {
      customer: "ABC",
      industry: "manufacturing",
      scale: "500",
      needs: ["document encryption"],
      constraints: [],
    },
    contentJson: null,
    pptFileKey: null,
    createdBy: "user-1",
    version: 1,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("proposal generation worker API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;
  const proposalFindFirst = vi.fn();
  const queueEnqueue = vi.fn();
  const progressStream = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    proposalFindFirst.mockReset();
    queueEnqueue.mockReset();
    progressStream.mockReset();
    stubCompleteEnv();

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
    jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("enqueues the proposal owner generation job", async () => {
    proposalFindFirst.mockResolvedValue(proposalRow());

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
    expect(proposalFindFirst).toHaveBeenCalledWith({
      where: { id: "proposal-1", deletedAt: null },
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

  it("returns 404 instead of enqueueing when the proposal is soft-deleted", async () => {
    proposalFindFirst.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}/api/internal/proposals/proposal-1/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(session()),
      },
      body: JSON.stringify({ templateId: "ip-guard-standard-v1" }),
    });

    expect(response.status).toBe(404);
    expect(queueEnqueue).not.toHaveBeenCalled();
  });

  it("returns 409 instead of enqueueing when the proposal is already finalized", async () => {
    proposalFindFirst.mockResolvedValue(proposalRow({ status: "final" }));

    const response = await fetch(`${baseUrl}/api/internal/proposals/proposal-1/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(session()),
      },
      body: JSON.stringify({ templateId: "ip-guard-standard-v1" }),
    });

    expect(response.status).toBe(409);
    expect(queueEnqueue).not.toHaveBeenCalled();
  });

  it("returns 400 instead of enqueueing when templateId is missing", async () => {
    proposalFindFirst.mockResolvedValue(proposalRow());

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
    proposalFindFirst.mockResolvedValue(proposalRow());

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
    proposalFindFirst.mockResolvedValue(proposalRow());
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

describe("proposal generation worker service e2e", () => {
  let moduleRef: TestingModule;
  let service: { generate(job: typeof generationJob): Promise<void> };
  const proposalFindFirst = vi.fn();
  const proposalUpdateMany = vi.fn();
  const userFindUnique = vi.fn();
  const queryRaw = vi.fn();
  const ragflowRetrieve = vi.fn();
  const llmComplete = vi.fn();
  const publish = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    stubCompleteEnv();
    proposalFindFirst.mockResolvedValue({ status: "draft" });
    proposalUpdateMany.mockResolvedValue({ count: 1 });
    userFindUnique.mockResolvedValue(generationUserRow);
    queryRaw.mockResolvedValue([{ ragflow_doc_id: "doc-visible" }]);
    ragflowRetrieve.mockResolvedValue([
      {
        id: "chunk-visible",
        documentId: "doc-visible",
        content: "IP-Guard supports transparent encryption, outbound controls, and audit evidence.",
        score: 0.98,
        metadata: { docName: "ip-guard.pdf", page: 3 },
      },
    ]);
    llmComplete.mockResolvedValue(longGeneratedBody("Generated section"));
    publish.mockResolvedValue(undefined);

    const { AppModule } = await import("../src/app.module");
    const { LLM_CLIENT } = await import("../src/clients/llm");
    const { RAGFLOW_CLIENT } = await import("../src/clients/ragflow");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const { ProposalGenerationService } = await import(
      "../src/proposal-worker/proposal-generation.service"
    );
    const { ProposalProgressService } = await import(
      "../src/proposal-worker/proposal-progress.service"
    );
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
        proposal: {
          findFirst: proposalFindFirst,
          updateMany: proposalUpdateMany,
        },
        user: {
          findUnique: userFindUnique,
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .overrideProvider(RAGFLOW_CLIENT)
      .useValue({ retrieve: ragflowRetrieve })
      .overrideProvider(LLM_CLIENT)
      .useValue({ complete: llmComplete })
      .overrideProvider(ProposalProgressService)
      .useValue({ publish })
      .compile();
    service = moduleRef.get(ProposalGenerationService);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await moduleRef?.close();
  });

  it("generates the v2 template with dynamic section bodies and fixed section content", async () => {
    await service.generate(generationJob);

    const sections = persistedSections();
    const dynamicSections = sections.filter((section) => dynamicSectionIds.has(section.id));
    expect(dynamicSections).toHaveLength(5);
    expect(dynamicSections.every((section) => section.body.length > 0)).toBe(true);
    expect(sections.find((section) => section.id === "project-background")?.body).toContain(
      "长江精密制造集团",
    );
    expect(proposalUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: generationJob.proposalId,
          deletedAt: null,
          status: "draft",
        },
        data: expect.objectContaining({ status: "draft_ready" }),
      }),
    );
    expect(ragflowRetrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        kbId: "proposal-kb",
        docIdWhitelist: ["doc-visible"],
      }),
      expect.objectContaining({ uid: generationJob.userId }),
    );
  });

  it("persists empty dynamic sections and logs when LLM completion fails", async () => {
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    llmComplete.mockRejectedValue(new Error("LLM unavailable"));

    try {
      await service.generate(generationJob);

      const sections = persistedSections();
      const dynamicSections = sections.filter((section) => dynamicSectionIds.has(section.id));
      expect(dynamicSections.every((section) => section.body.length === 0)).toBe(true);
      expect(proposalUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "draft_ready" }),
        }),
      );
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining("generation failed for proposal proposal-1"),
        expect.stringContaining("LLM unavailable"),
      );
      expect(publish).toHaveBeenCalledWith(
        generationJob.proposalId,
        expect.objectContaining({ chapter: "product-overview", errorMessage: "LLM unavailable" }),
      );
    } finally {
      errorLog.mockRestore();
    }
  });

  it("persists empty dynamic sections and logs when RAGFlow retrieval fails", async () => {
    const errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    ragflowRetrieve.mockRejectedValue(new Error("RAGFlow unavailable"));

    try {
      await service.generate(generationJob);

      const sections = persistedSections();
      const dynamicSections = sections.filter((section) => dynamicSectionIds.has(section.id));
      expect(dynamicSections.every((section) => section.body.length === 0)).toBe(true);
      expect(llmComplete).not.toHaveBeenCalled();
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining("generation failed for proposal proposal-1"),
        expect.stringContaining("RAGFlow unavailable"),
      );
      expect(publish).toHaveBeenCalledWith(
        generationJob.proposalId,
        expect.objectContaining({
          chapter: "product-overview",
          errorMessage: "RAGFlow unavailable",
        }),
      );
    } finally {
      errorLog.mockRestore();
    }
  });

  function persistedSections(): GeneratedSection[] {
    const data = proposalUpdateMany.mock.calls.at(-1)?.[0]?.data.contentJson as
      | { sections: GeneratedSection[] }
      | undefined;
    return data?.sections ?? [];
  }
});

const generationJob = {
  proposalId: "proposal-1",
  requirementJson: {
    customer: "长江精密制造集团",
    industry: "制造业",
    scale: "3500 人 / 4000 终端",
    needs: ["终端文档加密", "外发管控", "屏幕水印 / 行为审计"],
    constraints: ["私有化部署", "涉密图纸保护", "符合等保三级"],
  },
  templateId: "ip-guard-standard-v2",
  userId: "user-1",
};

const generationUserRow = {
  id: "user-1",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "mock-user-1",
  name: "Mock User",
  email: "mock.presales@example.com",
  role: "presales",
  isExternal: false,
  deptId: "dept-presales",
};

const dynamicSectionIds = new Set([
  "product-overview",
  "module-catalog",
  "feature-module-design",
  "deployment-architecture",
  "acceptance-criteria",
]);

interface GeneratedSection {
  id: string;
  title: string;
  body: string;
  refs: unknown[];
}

function longGeneratedBody(prefix: string): string {
  return `${prefix} ${"IP-Guard transparent encryption and audit controls. ".repeat(8)}[1]`;
}
