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

const user: SessionClaims = {
  uid: "user-1",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "mock-user-1",
  name: "Mock User",
  email: "mock.presales@example.com",
  role: "presales",
  isExternal: false,
  deptId: "dept-presales",
};

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    customerRef: "customer-a",
    opportunityRef: null,
    title: "Customer A Proposal",
    status: "draft_ready",
    requirementJson: { customer: "Customer A" },
    contentJson: {
      sections: [
        { title: "Background", body: "Original background", refs: ["doc-1"] },
        { id: "solution", title: "Solution", body: "Original solution", refs: [] },
      ],
    },
    pptFileKey: null,
    createdBy: "user-1",
    version: 3,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("proposal version management", () => {
  let app: INestApplication;
  let baseUrl: string;
  let authCookie: string;
  let currentProposal: ReturnType<typeof proposal>;
  let transactionActive: boolean;
  let proposalFindFirst: ReturnType<typeof vi.fn>;
  let proposalUpdate: ReturnType<typeof vi.fn>;
  let proposalUpdateMany: ReturnType<typeof vi.fn>;
  let versionCreate: ReturnType<typeof vi.fn>;
  let versionFindMany: ReturnType<typeof vi.fn>;
  let fieldAclFindMany: ReturnType<typeof vi.fn>;
  let aclAuditLogCreate: ReturnType<typeof vi.fn>;
  let aclAuditLogCreateMany: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    currentProposal = proposal();
    transactionActive = false;
    proposalFindFirst = vi.fn().mockImplementation(() =>
      Promise.resolve({ ...currentProposal }),
    );
    proposalUpdate = vi.fn().mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        currentProposal = proposal({
          ...currentProposal,
          ...data,
          version:
            typeof data.version === "object" && data.version !== null
              ? currentProposal.version + 1
              : (data.version ?? currentProposal.version),
        });
        return Promise.resolve(currentProposal);
      },
    );
    proposalUpdateMany = vi.fn().mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        currentProposal = proposal({
          ...currentProposal,
          ...data,
          version:
            typeof data.version === "object" && data.version !== null
              ? currentProposal.version + 1
              : (data.version ?? currentProposal.version),
        });
        return Promise.resolve({ count: 1 });
      },
    );
    versionCreate = vi.fn().mockResolvedValue({
      id: "version-1",
      proposalId: "proposal-1",
      version: 3,
      contentJson: currentProposal.contentJson,
      createdAt: new Date("2026-06-25T01:00:00.000Z"),
    });
    versionFindMany = vi.fn().mockResolvedValue([
      {
        id: "version-1",
        proposalId: "proposal-1",
        version: 3,
        contentJson: currentProposal.contentJson,
        createdAt: new Date("2026-06-25T01:00:00.000Z"),
      },
    ]);
    fieldAclFindMany = vi.fn().mockResolvedValue([]);
    aclAuditLogCreate = vi.fn().mockResolvedValue({});
    aclAuditLogCreateMany = vi.fn().mockResolvedValue({ count: 1 });

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const transactionClient = {
      proposal: {
        findFirst: proposalFindFirst,
        findUnique: vi.fn().mockImplementation(() => Promise.resolve(currentProposal)),
        update: proposalUpdate,
        updateMany: proposalUpdateMany,
      },
      proposalVersion: { create: versionCreate },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        proposal: {
          findFirst: proposalFindFirst,
          findUnique: vi.fn().mockImplementation(() => Promise.resolve(currentProposal)),
          findMany: vi.fn().mockResolvedValue([]),
          update: proposalUpdate,
          updateMany: proposalUpdateMany,
        },
        proposalVersion: {
          create: versionCreate,
          findMany: versionFindMany,
        },
        fieldAcl: {
          findMany: fieldAclFindMany,
        },
        aclAuditLog: {
          create: aclAuditLogCreate,
          createMany: aclAuditLogCreateMany,
        },
        $queryRaw: vi.fn().mockResolvedValue([]),
        $transaction: vi.fn(
          async (callback: (transaction: typeof transactionClient) => Promise<unknown>) => {
            transactionActive = true;
            try {
              return await callback(transactionClient);
            } finally {
              transactionActive = false;
            }
          },
        ),
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
    ).sign(user)}`;
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("finalizes atomically by snapshotting current content and preserving version", async () => {
    proposalFindFirst.mockImplementationOnce(() => {
      expect(transactionActive).toBe(true);
      return Promise.resolve({ ...currentProposal });
    });

    const response = await request("/api/internal/proposals/proposal-1/finalize", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(proposalFindFirst).toHaveBeenCalledWith({
      where: { id: "proposal-1", deletedAt: null },
    });
    expect(versionCreate).toHaveBeenCalledWith({
      data: {
        proposalId: "proposal-1",
        version: 3,
        contentJson: currentProposal.contentJson,
      },
    });
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        version: 3,
        status: "draft_ready",
        deletedAt: null,
        contentJson: { equals: expect.any(Object) },
      },
      data: { status: "final" },
    });
    await expect(response.json()).resolves.toMatchObject({
      status: "final",
      version: 3,
    });
  });

  it("rejects finalize when contentJson is absent", async () => {
    currentProposal = proposal({ contentJson: null });

    const response = await request("/api/internal/proposals/proposal-1/finalize", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(versionCreate).not.toHaveBeenCalled();
    expect(proposalUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 409 without a snapshot when finalize loses a concurrent update", async () => {
    proposalUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await request("/api/internal/proposals/proposal-1/finalize", {
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(versionCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when re-finalizing a proposal that is already final", async () => {
    currentProposal = proposal({ status: "final" });

    const response = await request("/api/internal/proposals/proposal-1/finalize", {
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(versionCreate).not.toHaveBeenCalled();
    expect(proposalUpdateMany).not.toHaveBeenCalled();
  });

  it("forks a finalized proposal to the next draft version before patching one section", async () => {
    currentProposal = proposal({ status: "final", version: 3 });

    const response = await request("/api/internal/proposals/proposal-1", {
      method: "PATCH",
      body: JSON.stringify({
        section: { id: "solution", body: "Revised solution" },
      }),
    });

    expect(response.status).toBe(200);
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        version: 3,
        status: "final",
        deletedAt: null,
        contentJson: { equals: expect.any(Object) },
      },
      data: {
        contentJson: {
          sections: [
            { title: "Background", body: "Original background", refs: ["doc-1"] },
            { id: "solution", title: "Solution", body: "Revised solution", refs: [] },
          ],
        },
        status: "draft",
        version: { increment: 1 },
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      status: "draft",
      version: 4,
    });
    expect(versionCreate).not.toHaveBeenCalled();
  });

  it("allows only one concurrent PATCH to fork the same final version", async () => {
    const original = proposal({ status: "final", version: 3 });
    currentProposal = original;
    proposalFindFirst.mockImplementation(() => Promise.resolve({ ...original }));
    let attempts = 0;
    proposalUpdateMany.mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        currentProposal = proposal({
          ...original,
          status: "draft",
          version: 4,
        });
        return { count: 1 };
      }
      return { count: 0 };
    });

    const responses = await Promise.all([
      request("/api/internal/proposals/proposal-1", {
        method: "PATCH",
        body: JSON.stringify({
          section: { id: "solution", body: "First revision" },
        }),
      }),
      request("/api/internal/proposals/proposal-1", {
        method: "PATCH",
        body: JSON.stringify({
          section: { id: "solution", body: "Second revision" },
        }),
      }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(proposalUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("lists snapshots only after owner validation", async () => {
    const response = await request("/api/internal/proposals/proposal-1/versions");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject([
      {
        id: "version-1",
        proposalId: "proposal-1",
        version: 3,
        contentJson: {
          sections: [
            {
              id: "section-1",
              title: "Background",
              body: "Original background",
              refs: ["doc-1"],
            },
            {
              id: "solution",
              title: "Solution",
              body: "Original solution",
              refs: [],
            },
          ],
        },
      },
    ]);
    expect(versionFindMany).toHaveBeenCalledWith({
      where: {
        proposalId: "proposal-1",
        proposal: {
          deletedAt: null,
          createdBy: "user-1",
        },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
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
