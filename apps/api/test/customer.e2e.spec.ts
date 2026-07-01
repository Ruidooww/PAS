import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Customer, Opportunity } from "@pas/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JwtSessionService } from "../src/auth/jwt-session.service";
import { SESSION_COOKIE_NAME, type SessionClaims } from "../src/auth/types";
import type { CrmClient } from "@pas/clients/crm";

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

type CrmClientErrorCtor = typeof import("@pas/clients/crm").CrmClientError;

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

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    ref: "cust-acme",
    name: "Acme Manufacturing",
    industry: "manufacturing",
    scale: 1200,
    ownerId: "user-1",
    ...overrides,
  };
}

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    ref: "opp-acme-dlp",
    customerRef: "cust-acme",
    title: "Acme DLP rollout",
    stage: "discovery",
    amountEstimate: 800_000,
    ownerId: "user-1",
    ...overrides,
  };
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    title: "Acme Proposal",
    status: "draft_ready",
    version: 2,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
    ...overrides,
  };
}

describe("customer CRM API", () => {
  let app: INestApplication;
  let baseUrl: string;
  let crm: {
    getCustomer: ReturnType<typeof vi.fn>;
    listCustomers: ReturnType<typeof vi.fn>;
    getOpportunity: ReturnType<typeof vi.fn>;
    listOpportunities: ReturnType<typeof vi.fn>;
    upsertOpportunity: ReturnType<typeof vi.fn>;
  };
  let cache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
  };
  let customerMirrorUpsert: ReturnType<typeof vi.fn>;
  let proposalFindMany: ReturnType<typeof vi.fn>;
  let computeVisibleProposalIds: ReturnType<typeof vi.fn>;
  let auditLogCreate: ReturnType<typeof vi.fn>;
  let fieldAclFindMany: ReturnType<typeof vi.fn>;
  let aclAuditLogCreate: ReturnType<typeof vi.fn>;
  let aclAuditLogCreateMany: ReturnType<typeof vi.fn>;
  let CrmClientError: CrmClientErrorCtor;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    crm = {
      getCustomer: vi.fn().mockResolvedValue(customer()),
      listCustomers: vi.fn().mockResolvedValue([customer()]),
      getOpportunity: vi.fn().mockResolvedValue(opportunity()),
      listOpportunities: vi.fn().mockResolvedValue([opportunity()]),
      upsertOpportunity: vi.fn(async (created: Opportunity) => created),
    };
    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
    customerMirrorUpsert = vi.fn().mockResolvedValue({
      ref: "cust-acme",
      syncedAt: new Date("2026-06-26T00:00:00.000Z"),
    });
    proposalFindMany = vi.fn().mockResolvedValue([proposal()]);
    computeVisibleProposalIds = vi.fn().mockResolvedValue(["proposal-1"]);
    auditLogCreate = vi.fn().mockResolvedValue({});
    fieldAclFindMany = vi.fn().mockResolvedValue([]);
    aclAuditLogCreate = vi.fn().mockResolvedValue({});
    aclAuditLogCreateMany = vi.fn().mockResolvedValue({ count: 1 });

    ({ CrmClientError } = await import("@pas/clients/crm"));
    const { AppModule } = await import("../src/app.module");
    const { CRM_CLIENT } = await import("../src/clients/crm");
    const { CustomerCacheService } = await import("../src/customer/customer-cache.service");
    const { AclService } = await import("../src/internal/acl.service");
    const { InternalOnlyGuard } = await import("../src/internal/internal-only.guard");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CRM_CLIENT)
      .useValue(crm satisfies CrmClient)
      .overrideProvider(CustomerCacheService)
      .useValue(cache)
      .overrideProvider(AclService)
      .useValue({ computeVisibleProposalIds })
      .overrideGuard(InternalOnlyGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(PrismaService)
      .useValue({
        customerMirror: {
          upsert: customerMirrorUpsert,
        },
        proposal: {
          findMany: proposalFindMany,
        },
        fieldAcl: {
          findMany: fieldAclFindMany,
        },
        aclAuditLog: {
          create: aclAuditLogCreate,
          createMany: aclAuditLogCreateMany,
        },
        auditLog: {
          create: auditLogCreate,
        },
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

  it("lists customers and returns items", async () => {
    const response = await request("/api/internal/customers?q=acme&ownerId=user-1&page=1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      items: [{ ref: "cust-acme", name: "Acme Manufacturing", source: "mock" }],
    });
    expect(crm.listCustomers).toHaveBeenCalledWith({
      q: "acme",
      ownerId: "user-1",
      page: 1,
    });
  });

  it("mirrors customer detail and returns visible proposals", async () => {
    const response = await request("/api/internal/customers/cust-acme");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ref: "cust-acme",
      source: "mock",
      syncedAt: "2026-06-26T00:00:00.000Z",
      proposals: [
        {
          id: "proposal-1",
          title: "Acme Proposal",
          status: "draft_ready",
          version: 2,
          createdAt: "2026-06-25T00:00:00.000Z",
        },
      ],
    });
    expect(customerMirrorUpsert).toHaveBeenCalledWith({
      where: { ref: "cust-acme" },
      create: expect.objectContaining({
        ref: "cust-acme",
        source: "mock",
        name: "Acme Manufacturing",
        ownerId: "user-1",
        syncedAt: expect.any(Date),
      }),
      update: expect.objectContaining({
        source: "mock",
        name: "Acme Manufacturing",
        ownerId: "user-1",
        syncedAt: expect.any(Date),
      }),
    });
    expect(computeVisibleProposalIds).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "user-1", role: "presales" }),
    );
    expect(proposalFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["proposal-1"] },
        customerRef: "cust-acme",
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        createdAt: true,
      },
    });
  });

  it("filters denied customer detail fields and writes ACL audit", async () => {
    fieldAclFindMany.mockResolvedValueOnce([
      {
        resourceType: "customer",
        resourceId: "cust-acme",
        fieldName: "scale",
        requiredRoles: ["admin"],
        requiredAttrs: {},
      },
    ]);

    const response = await request("/api/internal/customers/cust-acme");

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ref: "cust-acme", name: "Acme Manufacturing" });
    expect(body).not.toHaveProperty("scale");
    expect(aclAuditLogCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          resourceType: "customer",
          resourceId: "cust-acme",
          fieldName: "scale",
          action: "field_read_filter",
          reason: "required_roles_denied",
        },
      ],
    });
  });

  it("omits opportunity amountEstimate for external users", async () => {
    const response = await request("/api/internal/opportunities", {}, session({
      uid: "external-user",
      role: "external",
      isExternal: true,
      deptId: null,
    }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items[0]).toMatchObject({ ref: "opp-acme-dlp" });
    expect(body.items[0]).not.toHaveProperty("amountEstimate");
  });

  it("keeps opportunity amountEstimate for presales users", async () => {
    const response = await request("/api/internal/opportunities");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ ref: "opp-acme-dlp", amountEstimate: 800_000 }],
    });
  });

  it("creates an opportunity for presales users in mock CRM mode", async () => {
    const response = await request("/api/internal/opportunities", {
      method: "POST",
      body: JSON.stringify({
        customerRef: "cust-acme",
        title: "Acme 新增终端安全扩容",
        stage: "qualified",
        amountEstimate: 300_000,
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as Opportunity;
    expect(body).toMatchObject({
      ref: expect.stringMatching(/^opp-/),
      customerRef: "cust-acme",
      title: "Acme 新增终端安全扩容",
      stage: "qualified",
      amountEstimate: 300_000,
      ownerId: "user-1",
    });
    expect(crm.upsertOpportunity).toHaveBeenCalledWith(expect.objectContaining(body));
  });

  it("rejects invalid opportunity stages", async () => {
    const response = await request("/api/internal/opportunities", {
      method: "POST",
      body: JSON.stringify({
        customerRef: "cust-acme",
        title: "Bad stage",
        stage: "proposal",
        amountEstimate: 300_000,
      }),
    });

    expect(response.status).toBe(400);
    expect(crm.upsertOpportunity).not.toHaveBeenCalled();
  });

  it("rejects external users when creating opportunities", async () => {
    const response = await request(
      "/api/internal/opportunities",
      {
        method: "POST",
        body: JSON.stringify({
          customerRef: "cust-acme",
          title: "External create",
          stage: "qualified",
          amountEstimate: 300_000,
        }),
      },
      session({ uid: "external-user", role: "external", isExternal: true, deptId: null }),
    );

    expect(response.status).toBe(403);
    expect(crm.upsertOpportunity).not.toHaveBeenCalled();
  });

  it("returns a customer portrait with opportunity and proposal aggregates", async () => {
    crm.listOpportunities.mockResolvedValueOnce([
      { ...opportunity(), stage: "discovery", amountEstimate: 800_000 },
      {
        ...opportunity({
          ref: "opp-acme-expansion",
          stage: "qualified",
          amountEstimate: 300_000,
          createdAt: "2026-06-27T08:00:00.000Z",
        }),
      },
    ]);
    proposalFindMany.mockResolvedValueOnce([
      proposal({
        id: "proposal-new",
        status: "final",
        createdAt: new Date("2026-06-28T08:00:00.000Z"),
      }),
      proposal({
        id: "proposal-old",
        status: "draft",
        createdAt: new Date("2026-06-20T08:00:00.000Z"),
      }),
    ]);

    const response = await request("/api/internal/customers/cust-acme/portrait");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ref: "cust-acme",
      name: "Acme Manufacturing",
      industry: "manufacturing",
      scale: 1200,
      ownerId: "user-1",
      opportunities: {
        total: 2,
        byStage: { discovery: 1, qualified: 1 },
        latestUpdatedAt: "2026-06-27T08:00:00.000Z",
        totalAmountEstimate: 1_100_000,
      },
      proposals: {
        total: 2,
        latestStatus: "final",
        latestUpdatedAt: "2026-06-28T08:00:00.000Z",
      },
    });
    expect(proposalFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["proposal-1"] },
        customerRef: "cust-acme",
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        createdAt: true,
      },
    });
  });

  it("falls back to cached customer list on upstream 429", async () => {
    crm.listCustomers.mockRejectedValueOnce(new CrmClientError("rate limited", "external", 429));
    cache.get.mockResolvedValueOnce({
      page: 1,
      items: [{ ...customer(), source: "external" }],
    });

    const response = await request("/api/internal/customers?page=1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      fromCache: true,
      items: [{ ref: "cust-acme" }],
    });
    expect(cache.get).toHaveBeenCalledWith("list:::1");
  });

  it("maps CRM 404 errors to route 404", async () => {
    crm.getCustomer.mockRejectedValueOnce(
      new CrmClientError("missing customer", "external", 404),
    );

    const response = await request("/api/internal/customers/missing");

    expect(response.status).toBe(404);
  });

  it("rejects page=0", async () => {
    const response = await request("/api/internal/customers?page=0");

    expect(response.status).toBe(400);
    expect(crm.listCustomers).not.toHaveBeenCalled();
  });

  it("rejects pages beyond JavaScript safe integer range", async () => {
    const response = await request(`/api/internal/opportunities?page=${"9".repeat(400)}`);

    expect(response.status).toBe(400);
    expect(crm.listOpportunities).not.toHaveBeenCalled();
  });

  function request(
    path: string,
    init: RequestInit = {},
    user: SessionClaims = session(),
  ): Promise<Response> {
    const authCookie = `${SESSION_COOKIE_NAME}=${new JwtSessionService(
      completeEnv.JWT_SECRET,
      604_800,
    ).sign(user)}`;
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
