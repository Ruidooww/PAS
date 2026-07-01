import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RagflowApiError,
  RagflowClientImpl,
  type RagflowAclUserClaims,
  RETRIEVAL_DEFAULTS,
} from "../src/clients/ragflow";

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

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    RAGFLOW_BASE_URL: "http://localhost:9380",
    RAGFLOW_API_KEY: "test-key",
    ...overrides,
  };
  return {
    getOrThrow: (key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`missing ${key}`);
      return v;
    },
  } as unknown as ConfigService;
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function captureFetch(response: { ok: boolean; status: number; json?: unknown; text?: string }) {
  return captureFetchSequence([response]);
}

function captureFetchSequence(
  responses: Array<{ ok: boolean; status: number; json?: unknown; text?: string }>,
) {
  const captured: CapturedRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = responses[Math.min(captured.length, responses.length - 1)];
    if (!response) throw new Error("No mocked response available");
    const url = typeof input === "string" ? input : input.toString();
    const headersIn = new Headers(init?.headers);
    const headers: Record<string, string> = {};
    headersIn.forEach((v, k) => {
      headers[k] = v;
    });
    captured.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.json,
      text: async () => response.text ?? "",
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { captured, fetchMock };
}

describe("RagflowClientImpl.retrieve", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hits /api/v1/retrieval with bearer auth and exp-001 default params", async () => {
    const { captured } = captureFetch({
      ok: true,
      status: 200,
      json: { code: 0, data: { chunks: [], total: 0 } },
    });
    const client = new RagflowClientImpl(makeConfig());

    await client.retrieve({ query: "鍔犲瘑绛栫暐", kbId: "kb-abc" }, userClaims);

    expect(captured).toHaveLength(1);
    const req = captured[0]!;
    expect(req.url).toBe("http://localhost:9380/api/v1/retrieval");
    expect(req.method).toBe("POST");
    expect(req.headers["authorization"]).toBe("Bearer test-key");
    expect(req.headers["content-type"]).toBe("application/json");
    expect(req.body).toMatchObject({
      question: "鍔犲瘑绛栫暐",
      dataset_ids: ["kb-abc"],
      page_size: RETRIEVAL_DEFAULTS.pageSize,
      top_k: RETRIEVAL_DEFAULTS.topK,
      similarity_threshold: RETRIEVAL_DEFAULTS.similarityThreshold,
      vector_similarity_weight: RETRIEVAL_DEFAULTS.vectorSimilarityWeight,
      rerank_id: RETRIEVAL_DEFAULTS.rerankId,
    });
    // 涓嶄紶鐧藉悕鍗曟椂涓嶈鍑虹幇 document_ids锛岄伩鍏嶈鎶?[] 褰撹繃婊ゆ潯浠?
    expect(req.body).not.toHaveProperty("document_ids");
    expect(req.body).not.toHaveProperty("doc_ids");
  });

  it("passes docIdWhitelist as official `document_ids` and topK overrides page_size", async () => {
    const { captured } = captureFetch({
      ok: true,
      status: 200,
      json: { code: 0, data: { chunks: [] } },
    });
    const client = new RagflowClientImpl(makeConfig());

    await client.retrieve(
      {
        query: "q",
        kbId: "kb",
        topK: 5,
        docIdWhitelist: ["d1", "d2"],
      },
      userClaims,
    );

    expect(captured[0]!.body).toMatchObject({
      page_size: 5,
      document_ids: ["d1", "d2"],
    });
    // 鏃у埆鍚?doc_ids (MCP 鍖呰灞傜敤鐨? 涓嶈鍑虹幇 鈥?ACL 瀹夊叏濂戠害
    expect(captured[0]!.body).not.toHaveProperty("doc_ids");
  });

  it("maps response chunks using official field names (id + content)", async () => {
    captureFetch({
      ok: true,
      status: 200,
      json: {
        code: 0,
        data: {
          chunks: [
            {
              id: "c1",
              document_id: "d1",
              document_keyword: "IP-guard鎵嬪唽.pdf",
              content: "绛栫暐璁剧疆鍐呭",
              similarity: 0.45,
              term_similarity: 0.4,
              vector_similarity: 0.5,
              kb_id: "kb-abc",
            },
          ],
          total: 1,
        },
      },
    });
    const client = new RagflowClientImpl(makeConfig());

    const chunks = await client.retrieve({ query: "q", kbId: "kb-abc" }, userClaims);

    expect(chunks).toEqual([
      {
        id: "c1",
        documentId: "d1",
        content: "绛栫暐璁剧疆鍐呭",
        score: 0.45,
        metadata: {
          kbId: "kb-abc",
          documentKeyword: "IP-guard鎵嬪唽.pdf",
          termSimilarity: 0.4,
          vectorSimilarity: 0.5,
          positions: undefined,
          imageId: undefined,
          highlight: undefined,
        },
      },
    ]);
  });

  it("accepts legacy field names (chunk_id + content_with_weight) as fallback", async () => {
    captureFetch({
      ok: true,
      status: 200,
      json: {
        code: 0,
        data: {
          chunks: [
            {
              chunk_id: "c2",
              document_id: "d2",
              content_with_weight: "鍏煎鏃у瓧娈靛悕",
              similarity: 0.3,
            },
          ],
        },
      },
    });
    const client = new RagflowClientImpl(makeConfig());

    const chunks = await client.retrieve({ query: "q", kbId: "kb" }, userClaims);
    expect(chunks[0]).toMatchObject({ id: "c2", content: "鍏煎鏃у瓧娈靛悕", score: 0.3 });
  });

  it("rejects chunk missing both `id` and `chunk_id`", async () => {
    captureFetch({
      ok: true,
      status: 200,
      json: {
        code: 0,
        data: { chunks: [{ document_id: "d1", content: "x" }] },
      },
    });
    const client = new RagflowClientImpl(makeConfig());
    await expect(client.retrieve({ query: "q", kbId: "kb" }, userClaims)).rejects.toThrow(/id/);
  });

  it("preserves NaN score when similarity is missing (distinguishes from 0)", async () => {
    captureFetch({
      ok: true,
      status: 200,
      json: {
        code: 0,
        data: { chunks: [{ id: "c3", document_id: "d3", content: "no score" }] },
      },
    });
    const client = new RagflowClientImpl(makeConfig());
    const chunks = await client.retrieve({ query: "q", kbId: "kb" }, userClaims);
    expect(Number.isNaN(chunks[0]!.score)).toBe(true);
  });

  it("throws RagflowApiError with HTTP status on 4xx/5xx", async () => {
    captureFetch({
      ok: false,
      status: 502,
      text: "upstream timeout",
    });
    const client = new RagflowClientImpl(makeConfig());

    await expect(client.retrieve({ query: "q", kbId: "kb" }, userClaims)).rejects.toMatchObject({
      name: "RagflowApiError",
      status: 502,
      bodySnippet: expect.stringContaining("upstream timeout"),
    });
  });

  it("throws RagflowApiError on network failure (fetch throws)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const client = new RagflowClientImpl(makeConfig());

    const err = await client
      .retrieve({ query: "q", kbId: "kb" }, userClaims)
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(RagflowApiError);
    expect((err as RagflowApiError).status).toBe(0);
  });

  it("throws RagflowApiError when RAGFlow returns non-zero code", async () => {
    captureFetch({
      ok: true,
      status: 200,
      json: { code: 102, message: "invalid kb" },
    });
    const client = new RagflowClientImpl(makeConfig());

    await expect(client.retrieve({ query: "q", kbId: "kb" }, userClaims)).rejects.toMatchObject({
      name: "RagflowApiError",
      message: expect.stringContaining("code=102"),
    });
  });
});

describe("RagflowClientImpl other methods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chat() throws 501 directing to PAS self-orchestration", async () => {
    const client = new RagflowClientImpl(makeConfig());
    const iter = client.chat({ kbId: "kb", messages: [{ role: "user", content: "q" }] });
    const consume = async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iter) {
        // no-op
      }
    };
    await expect(consume()).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining("mode B"),
    });
  });

  it("listDocs() hits /datasets/:id/documents and maps to RagflowDocument", async () => {
    const { captured } = captureFetch({
      ok: true,
      status: 200,
      json: {
        code: 0,
        data: {
          docs: [
            {
              id: "d1",
              name: "鎵嬪唽.pdf",
              status: "ready",
              size: 42,
              chunk_count: 17,
              updated_at: "2026-06-02T03:04:05.000Z",
            },
            {
              id: "d2",
              name: "鐧界毊涔?pdf",
              run: "DONE",
              update_time: Date.parse("2026-06-03T04:05:06.000Z"),
            },
          ],
        },
      },
    });
    const client = new RagflowClientImpl(makeConfig());

    const docs = await client.listDocs("kb-abc");

    expect(captured[0]!.url).toContain("/api/v1/datasets/kb-abc/documents");
    expect(captured[0]!.method).toBe("GET");
    expect(docs).toEqual([
      {
        id: "d1",
        name: "鎵嬪唽.pdf",
        status: "ready",
        size: 42,
        chunkCount: 17,
        updatedAt: "2026-06-02T03:04:05.000Z",
      },
      {
        id: "d2",
        name: "鐧界毊涔?pdf",
        status: "DONE",
        updatedAt: "2026-06-03T04:05:06.000Z",
      },
    ]);
  });

  it("listDocs() pages through all RAGFlow documents when total exceeds page size", async () => {
    const firstPageDocs = Array.from({ length: 100 }, (_, index) => ({
      id: `d${index + 1}`,
      name: `Doc ${index + 1}`,
      run: "DONE",
    }));
    const { captured } = captureFetchSequence([
      {
        ok: true,
        status: 200,
        json: { code: 0, data: { total: 101, docs: firstPageDocs } },
      },
      {
        ok: true,
        status: 200,
        json: {
          code: 0,
          data: {
            total: 101,
            docs: [{ id: "d101", name: "Doc 101", status: "ready", chunk_count: 3 }],
          },
        },
      },
    ]);
    const client = new RagflowClientImpl(makeConfig());

    const docs = await client.listDocs("kb-abc");

    expect(docs).toHaveLength(101);
    expect(docs[100]).toMatchObject({ id: "d101", name: "Doc 101", chunkCount: 3 });
    expect(captured).toHaveLength(2);
    expect(new URL(captured[0]!.url).searchParams.get("page")).toBe("1");
    expect(new URL(captured[0]!.url).searchParams.get("page_size")).toBe("100");
    expect(new URL(captured[1]!.url).searchParams.get("page")).toBe("2");
    expect(new URL(captured[1]!.url).searchParams.get("page_size")).toBe("100");
  });

  it("graphQuery / uploadDoc throw 501", async () => {
    const client = new RagflowClientImpl(makeConfig());
    await expect(client.graphQuery({ entity: "x", kbId: "kb" })).rejects.toMatchObject({
      status: 501,
    });
    await expect(
      client.uploadDoc("kb", Buffer.from(""), { title: "t" }),
    ).rejects.toMatchObject({ status: 501 });
  });
});

describe("RagflowClientImpl auth + URL", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips trailing slash from RAGFLOW_BASE_URL to avoid double slashes", async () => {
    const { captured } = captureFetch({
      ok: true,
      status: 200,
      json: { code: 0, data: { chunks: [] } },
    });
    const client = new RagflowClientImpl(makeConfig({ RAGFLOW_BASE_URL: "http://x:9380/" }));
    await client.retrieve({ query: "q", kbId: "kb" }, userClaims);
    expect(captured[0]!.url).toBe("http://x:9380/api/v1/retrieval");
    expect(captured[0]!.url).not.toContain("//api");
  });
});
