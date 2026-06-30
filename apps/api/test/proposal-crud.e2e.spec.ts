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
        {
          id: "solution",
          title: "Solution",
          body: "Original solution",
          refs: ["doc-2"],
        },
      ],
    },
    pptFileKey: null,
    createdBy: "user-1",
    version: 1,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("proposal CRUD API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let authCookie: string;
  let proposalFindMany: ReturnType<typeof vi.fn>;
  let proposalFindFirst: ReturnType<typeof vi.fn>;
  let proposalFindUnique: ReturnType<typeof vi.fn>;
  let proposalCount: ReturnType<typeof vi.fn>;
  let proposalUpdate: ReturnType<typeof vi.fn>;
  let proposalUpdateMany: ReturnType<typeof vi.fn>;
  let fieldAclFindMany: ReturnType<typeof vi.fn>;
  let aclAuditLogCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    proposalFindMany = vi.fn().mockImplementation((args: Record<string, unknown>) => {
      if ("select" in args) {
        return Promise.resolve([{ id: "proposal-1" }, { id: "proposal-dept" }]);
      }
      return Promise.resolve([
        proposal(),
        proposal({
          id: "proposal-dept",
          createdBy: "user-2",
          customerRef: "customer-b",
          title: "Same Department Proposal",
        }),
      ]);
    });
    proposalFindFirst = vi.fn().mockResolvedValue(proposal());
    proposalFindUnique = vi.fn().mockResolvedValue(proposal());
    proposalCount = vi.fn().mockResolvedValue(2);
    proposalUpdate = vi.fn().mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(proposal({ ...data })),
    );
    proposalUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    fieldAclFindMany = vi.fn().mockResolvedValue([]);
    aclAuditLogCreate = vi.fn().mockResolvedValue({});

    const { AppModule } = await import("../src/app.module");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        proposal: {
          count: proposalCount,
          findMany: proposalFindMany,
          findFirst: proposalFindFirst,
          findUnique: proposalFindUnique,
          update: proposalUpdate,
          updateMany: proposalUpdateMany,
        },
        proposalVersion: {
          create: vi.fn(),
          findMany: vi.fn(),
        },
        fieldAcl: {
          findMany: fieldAclFindMany,
        },
        aclAuditLog: {
          create: aclAuditLogCreate,
        },
        $queryRaw: vi.fn().mockResolvedValue([]),
        $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) =>
          callback({
            proposal: {
              findFirst: proposalFindFirst,
              findUnique: proposalFindUnique,
              update: proposalUpdate,
              updateMany: proposalUpdateMany,
            },
            proposalVersion: { create: vi.fn() },
            fieldAcl: { findMany: fieldAclFindMany },
            aclAuditLog: { create: aclAuditLogCreate },
          }),
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
    ).sign(session())}`;
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("lists undeleted owned and same-department proposals with stable pagination", async () => {
    const response = await request("/api/internal/proposals?customerRef=customer-a&page=1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      items: [
        { id: "proposal-1", customerRef: "customer-a" },
        { id: "proposal-dept", customerRef: "customer-b" },
      ],
    });
    expect(proposalFindMany).toHaveBeenLastCalledWith({
      where: {
        id: { in: ["proposal-1", "proposal-dept"] },
        deletedAt: null,
        customerRef: "customer-a",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 0,
      take: 20,
    });
  });

  it("rejects a non-positive page", async () => {
    const response = await request("/api/internal/proposals?page=0");

    expect(response.status).toBe(400);
    expect(proposalFindMany).not.toHaveBeenCalled();
  });

  it("rejects a page that is not a safe integer", async () => {
    const response = await request(
      `/api/internal/proposals?page=${"9".repeat(400)}`,
    );

    expect(response.status).toBe(400);
    expect(proposalFindMany).not.toHaveBeenCalled();
  });

  it("returns stable fallback section ids in detail responses", async () => {
    const response = await request("/api/internal/proposals/proposal-1");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      contentJson: { sections: Array<Record<string, unknown>> };
    };
    expect(body.contentJson.sections).toEqual([
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
        refs: ["doc-2"],
      },
    ]);
  });

  it("filters denied proposal detail fields and writes ACL audit", async () => {
    fieldAclFindMany.mockResolvedValueOnce([
      {
        resourceType: "proposal",
        resourceId: "proposal-1",
        fieldName: "requirementJson",
        requiredRoles: ["admin"],
        requiredAttrs: {},
      },
    ]);

    const response = await request("/api/internal/proposals/proposal-1");

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ id: "proposal-1", title: "Customer A Proposal" });
    expect(body).not.toHaveProperty("requirementJson");
    expect(aclAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        resourceType: "proposal",
        resourceId: "proposal-1",
        fieldName: "requirementJson",
        action: "field_read_filter",
        reason: "required_roles_denied",
      },
    });
  });

  it("trims whitespace-padded section ids and keeps PATCH addressable", async () => {
    proposalFindFirst.mockResolvedValue(
      proposal({
        contentJson: {
          sections: [
            { id: "  background  ", title: "Background", body: "B", refs: [] },
            { id: "solution", title: "Solution", body: "S", refs: [] },
          ],
        },
      }),
    );

    const detail = await request("/api/internal/proposals/proposal-1");
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as {
      contentJson: { sections: Array<Record<string, unknown>> };
    };
    expect(detailBody.contentJson.sections.map((section) => section.id)).toEqual([
      "background",
      "solution",
    ]);

    const patch = await request("/api/internal/proposals/proposal-1", {
      method: "PATCH",
      body: JSON.stringify({
        section: { id: "background", body: "Updated background" },
      }),
    });
    expect(patch.status).toBe(200);
  });

  it("resolves duplicate explicit section ids by demoting later occurrences to fallback ids", async () => {
    proposalFindFirst.mockResolvedValue(
      proposal({
        contentJson: {
          sections: [
            { id: "solution", title: "First", body: "A", refs: [] },
            { id: "solution", title: "Second", body: "B", refs: [] },
            { id: "solution", title: "Third", body: "C", refs: [] },
          ],
        },
      }),
    );

    const detail = await request("/api/internal/proposals/proposal-1");
    const detailBody = (await detail.json()) as {
      contentJson: { sections: Array<Record<string, unknown>> };
    };
    expect(detailBody.contentJson.sections.map((section) => section.id)).toEqual([
      "solution",
      "section-2",
      "section-3",
    ]);
  });

  it("avoids collisions between fallback and explicit section ids", async () => {
    proposalFindFirst.mockResolvedValueOnce(
      proposal({
        contentJson: {
          sections: [
            { title: "Background", body: "Original background", refs: [] },
            {
              id: "section-1",
              title: "Explicit",
              body: "Explicit body",
              refs: [],
            },
          ],
        },
      }),
    );

    const response = await request("/api/internal/proposals/proposal-1");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      contentJson: { sections: Array<Record<string, unknown>> };
    };
    expect(body.contentJson.sections.map((section) => section.id)).toEqual([
      "section-2",
      "section-1",
    ]);
  });

  it("queries owned proposals with deletedAt filtered in the database", async () => {
    const response = await request("/api/internal/proposals/proposal-1");

    expect(response.status).toBe(200);
    expect(proposalFindFirst).toHaveBeenCalledWith({
      where: { id: "proposal-1", deletedAt: null },
    });
  });

  it("returns 403 when a proposal exists but belongs to another user", async () => {
    proposalFindFirst.mockResolvedValueOnce(proposal({ createdBy: "user-2" }));

    const response = await request("/api/internal/proposals/proposal-1");

    expect(response.status).toBe(403);
  });

  it("returns 404 for soft-deleted proposals", async () => {
    proposalFindFirst.mockResolvedValueOnce(null);

    const response = await request("/api/internal/proposals/proposal-1");

    expect(response.status).toBe(404);
  });

  it("patches one fallback-id section without changing refs or other sections", async () => {
    const response = await request("/api/internal/proposals/proposal-1", {
      method: "PATCH",
      body: JSON.stringify({
        section: { id: "section-1", body: "Updated background" },
      }),
    });

    expect(response.status).toBe(200);
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        version: 1,
        status: "draft_ready",
        deletedAt: null,
        contentJson: { equals: proposal().contentJson },
      },
      data: {
        contentJson: {
          sections: [
            {
              title: "Background",
              body: "Updated background",
              refs: ["doc-1"],
            },
            {
              id: "solution",
              title: "Solution",
              body: "Original solution",
              refs: ["doc-2"],
            },
          ],
        },
      },
    });
  });

  it("silently strips denied proposal content updates", async () => {
    fieldAclFindMany
      .mockResolvedValueOnce([
        {
          resourceType: "proposal",
          resourceId: "proposal-1",
          fieldName: "contentJson",
          requiredRoles: ["admin"],
          requiredAttrs: {},
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await request("/api/internal/proposals/proposal-1", {
      method: "PATCH",
      body: JSON.stringify({
        section: { id: "section-1", body: "Denied background" },
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { contentJson: { sections: Array<{ body: string }> } };
    expect(body.contentJson.sections[0]?.body).toBe("Original background");
    expect(proposalUpdateMany).not.toHaveBeenCalled();
    expect(aclAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        resourceType: "proposal",
        resourceId: "proposal-1",
        fieldName: "contentJson",
        action: "field_write_filter",
        reason: "required_roles_denied",
      }),
    });
  });

  it("patches the collision-free fallback id returned by detail", async () => {
    const collisionContent = {
      sections: [
        { title: "Background", body: "Original background", refs: ["doc-1"] },
        {
          id: "section-1",
          title: "Explicit",
          body: "Explicit body",
          refs: [],
        },
      ],
    };
    proposalFindFirst.mockResolvedValueOnce(
      proposal({ contentJson: collisionContent }),
    );

    const response = await request("/api/internal/proposals/proposal-1", {
      method: "PATCH",
      body: JSON.stringify({
        section: { id: "section-2", body: "Updated background" },
      }),
    });

    expect(response.status).toBe(200);
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        version: 1,
        status: "draft_ready",
        deletedAt: null,
        contentJson: { equals: collisionContent },
      },
      data: {
        contentJson: {
          sections: [
            {
              title: "Background",
              body: "Updated background",
              refs: ["doc-1"],
            },
            {
              id: "section-1",
              title: "Explicit",
              body: "Explicit body",
              refs: [],
            },
          ],
        },
      },
    });
  });

  it("rejects an unknown section id without updating", async () => {
    const response = await request("/api/internal/proposals/proposal-1", {
      method: "PATCH",
      body: JSON.stringify({
        section: { id: "missing", body: "No-op" },
      }),
    });

    expect(response.status).toBe(404);
    expect(proposalUpdateMany).not.toHaveBeenCalled();
  });

  it("soft deletes an owned proposal", async () => {
    const response = await request("/api/internal/proposals/proposal-1", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(proposalUpdate).toHaveBeenCalledWith({
      where: { id: "proposal-1" },
      data: { deletedAt: expect.any(Date) },
    });
    await expect(response.json()).resolves.toEqual({
      id: "proposal-1",
      deleted: true,
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
