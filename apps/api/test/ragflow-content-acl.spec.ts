import { ConfigService } from "@nestjs/config";
import type { Chunk } from "@pas/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionClaims } from "../src/auth/types";
import { filterChunksBySensitivity, RagflowClientImpl } from "../src/clients/ragflow";
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

function captureFetch(
  chunks: Array<{ id: string; document_id: string; content: string; similarity: number }> = [
    { id: "chunk-public", document_id: "doc-public", content: "public", similarity: 1 },
    {
      id: "chunk-regulated",
      document_id: "doc-regulated",
      content: "sensitive contract value",
      similarity: 1,
    },
  ],
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          chunks,
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

  it("requires userClaims on retrieve and batches denied chunk audit writes", async () => {
    captureFetch();
    const aclAuditLogCreateMany = vi.fn().mockResolvedValue({ count: 1 });
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
      aclAuditLog: { createMany: aclAuditLogCreateMany },
    } as unknown as PrismaService);

    const userClaims = user({
      uid: "external-1",
      role: "external",
      isExternal: true,
      deptId: null,
    });

    const chunks = await client.retrieve(
      {
        query: "q",
        kbId: "kb",
        docIdWhitelist: ["doc-public", "doc-regulated"],
      },
      userClaims,
    );

    expect(chunks.map((item) => item.id)).toEqual(["chunk-public"]);
    expect(aclAuditLogCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "external-1",
          resourceType: "kb_document",
          resourceId: "doc-regulated",
          chunkId: "chunk-regulated",
          action: "content_filter",
          reason: "chunk_sensitivity_denied:regulated",
        },
      ],
    });
    expect(JSON.stringify(aclAuditLogCreateMany.mock.calls)).not.toContain(
      "sensitive contract value",
    );
  });

  it("accepts string and object chunkSensitivityMap overrides", async () => {
    captureFetch([
      {
        id: "chunk-object-public",
        document_id: "doc-mixed",
        content: "public chunk",
        similarity: 1,
      },
      {
        id: "chunk-string-regulated",
        document_id: "doc-mixed",
        content: "regulated chunk",
        similarity: 1,
      },
    ]);
    const aclAuditLogCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = new RagflowClientImpl(makeConfig(), {
      kbDocument: {
        findMany: vi.fn().mockResolvedValue([
          {
            ragflowDocId: "doc-mixed",
            sensitivity: "internal",
            chunkSensitivityMap: {
              "chunk-object-public": { sensitivity: "public", confidence: 0.9 },
              "chunk-string-regulated": "regulated",
            },
          },
        ]),
      },
      aclAuditLog: { createMany: aclAuditLogCreateMany },
    } as unknown as PrismaService);

    const chunks = await client.retrieve(
      {
        query: "q",
        kbId: "kb",
        docIdWhitelist: ["doc-mixed"],
      },
      user({ uid: "external-1", role: "external", isExternal: true, deptId: null }),
    );

    expect(chunks.map((item) => item.id)).toEqual(["chunk-object-public"]);
    expect(aclAuditLogCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "external-1",
          resourceType: "kb_document",
          resourceId: "doc-mixed",
          chunkId: "chunk-string-regulated",
          action: "content_filter",
          reason: "chunk_sensitivity_denied:regulated",
        },
      ],
    });
  });
});
