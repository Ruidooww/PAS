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

describe("proposal requirement draft", () => {
  let app: INestApplication;
  let baseUrl: string;
  let authCookie: string;
  let llmComplete: ReturnType<typeof vi.fn>;
  let proposalCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }

    llmComplete = vi.fn();
    proposalCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "proposal-1",
      ...data,
      opportunityRef: data.opportunityRef ?? null,
      contentJson: null,
      version: 1,
      createdAt: new Date("2026-06-25T00:00:00.000Z"),
    }));

    const { AppModule } = await import("../src/app.module");
    const { LLM_CLIENT } = await import("../src/clients/llm");
    const { PrismaService } = await import("../src/prisma/prisma.service");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_CLIENT)
      .useValue({
        complete: llmComplete,
        stream: vi.fn(),
      })
      .overrideProvider(PrismaService)
      .useValue({
        proposal: {
          create: proposalCreate,
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();
    const jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    authCookie = `${SESSION_COOKIE_NAME}=${jwt.sign(session())}`;
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("creates requirementJson directly from formFields when freeText is absent", async () => {
    const response = await postDraftRequirement({
      formFields: {
        customerName: "ABC 公司",
        industry: "制造业",
        scale: "500 人",
        needs: ["文档加密"],
        constraints: ["私有化部署"],
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "proposal-1",
      customerRef: "ABC 公司",
      title: "ABC 公司需求方案",
      status: "draft",
      requirementJson: {
        customer: "ABC 公司",
        industry: "制造业",
        scale: "500 人",
        needs: ["文档加密"],
        constraints: ["私有化部署"],
      },
      createdBy: "user-1",
    });
    expect(llmComplete).not.toHaveBeenCalled();
    expect(proposalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerRef: "ABC 公司",
        title: "ABC 公司需求方案",
        status: "draft",
        createdBy: "user-1",
      }),
    });
  });

  it("uses the LlmClient abstraction to complete structured fields from freeText", async () => {
    llmComplete.mockResolvedValueOnce(
      JSON.stringify({
        requirement_json: {
          customer: "ABC 公司",
          industry: "企业服务",
          scale: "500 人",
          needs: ["文档加密"],
          constraints: [],
        },
      }),
    );

    const response = await postDraftRequirement({
      freeText: "客户 ABC 公司 500 人，关心文档加密",
      formFields: {
        customerName: "",
        industry: "",
        scale: "",
        needs: [],
        constraints: [],
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      customerRef: "ABC 公司",
      status: "draft",
      requirementJson: {
        customer: "ABC 公司",
        industry: "企业服务",
        scale: "500 人",
        needs: ["文档加密"],
        constraints: [],
      },
    });
    expect(llmComplete).toHaveBeenCalledTimes(1);
    expect(llmComplete).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("纯 JSON"),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("客户 ABC 公司 500 人，关心文档加密"),
        }),
      ],
      temperature: 0,
    });
  });

  it("preserves non-empty form fields when the LLM returns conflicting values", async () => {
    llmComplete.mockResolvedValueOnce(
      JSON.stringify({
        requirement_json: {
          customer: "错误客户",
          industry: "错误行业",
          scale: "100 人",
          needs: ["行为审计"],
          constraints: ["公有云"],
        },
      }),
    );

    const response = await postDraftRequirement({
      freeText: "补充说明：需要兼容现有终端。",
      formFields: {
        customerName: "ABC 公司",
        industry: "制造业",
        scale: "500 人",
        needs: ["文档加密"],
        constraints: ["私有化部署"],
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      customerRef: "ABC 公司",
      requirementJson: {
        customer: "ABC 公司",
        industry: "制造业",
        scale: "500 人",
        needs: ["文档加密"],
        constraints: ["私有化部署"],
      },
    });
  });

  it("returns 400 when the request schema is missing needs", async () => {
    const response = await postDraftRequirement({
      formFields: {
        customerName: "ABC 公司",
        industry: "制造业",
        scale: "500 人",
        constraints: [],
      },
    });

    expect(response.status).toBe(400);
    expect(proposalCreate).not.toHaveBeenCalled();
    expect(llmComplete).not.toHaveBeenCalled();
  });

  it("retries the same prompt once and returns raw output with 422", async () => {
    llmComplete
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(
        JSON.stringify({
          requirement_json: {
            customer: "ABC 公司",
          },
        }),
      );

    const response = await postDraftRequirement({
      freeText: "客户 ABC 公司 500 人，关心文档加密",
      formFields: {
        customerName: "",
        industry: "",
        scale: "",
        needs: [],
        constraints: [],
      },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message: "LLM output failed requirement validation",
      rawOutput: expect.stringContaining('"customer":"ABC 公司"'),
    });
    expect(llmComplete).toHaveBeenCalledTimes(2);
    expect(llmComplete.mock.calls[1]).toEqual(llmComplete.mock.calls[0]);
    expect(proposalCreate).not.toHaveBeenCalled();
  });

  function postDraftRequirement(body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/internal/proposals/draft-requirement`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie,
      },
      body: JSON.stringify(body),
    });
  }
});
