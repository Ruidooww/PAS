import type { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RagflowAclUserClaims } from "./ragflow";

const userClaims: RagflowAclUserClaims = {
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

function makeConfig(): ConfigService {
  const values: Record<string, string> = {
    RAGFLOW_BASE_URL: "http://localhost:9380",
    RAGFLOW_API_KEY: "test-key",
  };
  return {
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`missing ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

describe("RagflowClientImpl runtime tuning", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses PAS_RAGFLOW_TOP_K in retrieval request payload", async () => {
    vi.stubEnv("PAS_RAGFLOW_TOP_K", "5");
    vi.resetModules();
    const capturedBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return {
          ok: true,
          status: 200,
          json: async () => ({ code: 0, data: { chunks: [] } }),
          text: async () => "",
        } as unknown as Response;
      }),
    );
    const { RagflowClientImpl } = await import("./ragflow");

    await new RagflowClientImpl(makeConfig()).retrieve(
      { query: "q", kbId: "kb" },
      userClaims,
    );

    expect(capturedBodies[0]).toMatchObject({
      page_size: 30,
      top_k: 5,
    });
  });
});
