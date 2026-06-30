import { ConfigService } from "@nestjs/config";
import type { Chunk } from "@pas/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionClaims } from "../src/auth/types";
import {
  filterChunksBySensitivity,
  RagflowClientImpl,
  runWithRagflowAclContext,
} from "../src/clients/ragflow";
import type { PrismaService } from "../src/prisma/prisma.service";

function user(overrides: Partial<SessionClaims> = {}): SessionClaims {
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

function chunk(id: string, sensitivity: string): Chunk {
  return {
    id,
    documentId: `doc-${id}`,
    content: `${sensitivity} content`,
    score: 1,
    metadata: { sensitivity },
  };
}

function makeConfig(): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (key === "RAGFLOW_BASE_URL") return "http://localhost:9380";
      if (key === "RAGFLOW_API_KEY") return "test-key";
      throw new Error(`missing ${key}`);
    },
  } as unknown as ConfigService;
}

function captureFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          chunks: [
            { id: "chunk-public", document_id: "doc-public", content: "public", similarity: 1 },
            {
              id: "chunk-regulated",
              document_id: "doc-regulated",
              content: "sensitive contract value",
              similarity: 1,
            },
          ],
        },
      }),
      text: async () => "",
    })) as never,
  );
}

describe("filterChunksBySensitivity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows external users to see public chunks only", () => {
    const filtered = filterChunksBySensitivity(
      [
        chunk("public", "public"),
        chunk("internal", "internal"),
        chunk("regulated", "regulated"),
      ],
      user({ uid: "external-1", role: "external", isExternal: true, deptId: null }),
    );

    expect(filtered.map((item) => item.id)).toEqual(["public"]);
  });

  it("allows admin or compliance claims to see regulated chunks", () => {
    const filtered = filterChunksBySensitivity(
      [chunk("regulated", "regulated")],
      user({ role: "admin" }),
    );

    expect(filtered.map((item) => item.id)).toEqual(["regulated"]);
  });

  it("applies the retrieve hook without changing RagflowClient.retrieve params", async () => {
    captureFetch();
    const aclAuditLogCreate = vi.fn().mockResolvedValue({});
    const client = new RagflowClientImpl(makeConfig(), {
      kbDocument: {
        findMany: vi.fn().mockResolvedValue([
          {
            ragflowDocId: "doc-public",
            sensitivity: "internal",
            chunkSensitivityMap: { "chunk-public": "public" },
          },
          {
            ragflowDocId: "doc-regulated",
            sensitivity: "internal",
            chunkSensitivityMap: { "chunk-regulated": "regulated" },
          },
        ]),
      },
      aclAuditLog: { create: aclAuditLogCreate },
    } as unknown as PrismaService);

    const chunks = await runWithRagflowAclContext(
      user({ uid: "external-1", role: "external", isExternal: true, deptId: null }),
      () =>
        client.retrieve({
          query: "q",
          kbId: "kb",
          docIdWhitelist: ["doc-public", "doc-regulated"],
        }),
    );

    expect(chunks.map((item) => item.id)).toEqual(["chunk-public"]);
    expect(aclAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "external-1",
        resourceType: "kb_document",
        resourceId: "doc-regulated",
        chunkId: "chunk-regulated",
        action: "content_filter",
        reason: "chunk_sensitivity_denied:regulated",
      },
    });
    expect(JSON.stringify(aclAuditLogCreate.mock.calls)).not.toContain(
      "sensitive contract value",
    );
  });
});
