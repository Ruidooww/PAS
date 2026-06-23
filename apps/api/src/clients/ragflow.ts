// RAGFlow REST client.
// 走 REST，不走 MCP — 见 exp-001 决策反转 (ADR-001 § 决策修订记录)：
// FastGPT workflow + MCP 路径 MVP 不可用，PAS 自编排直连 RAGFlow REST。
// MCP 留作 v2 候选。

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  ChatMessage,
  Chunk,
  GraphResult,
  RagflowDocument,
  RagflowDocumentMeta,
} from "@pas/shared";
import { z } from "zod";

export const RAGFLOW_CLIENT = Symbol("RAGFLOW_CLIENT");

export interface RagflowClient {
  retrieve(params: {
    query: string;
    kbId: string;
    topK?: number;
    docIdWhitelist?: string[];
  }): Promise<Chunk[]>;
  chat(params: { messages: ChatMessage[]; kbId: string }): AsyncIterable<string>;
  graphQuery(params: { entity: string; kbId: string; hops?: number }): Promise<GraphResult>;
  listDocs(kbId: string): Promise<RagflowDocument[]>;
  uploadDoc(kbId: string, file: Buffer, meta: RagflowDocumentMeta): Promise<string>;
}

// exp-001 实证的检索默认参数。调参由 W1 gate harness 驱动，业务层不要覆盖。
export const RETRIEVAL_DEFAULTS = Object.freeze({
  pageSize: 30,
  topK: 1024,
  similarityThreshold: 0.1,
  vectorSimilarityWeight: 0.3,
  rerankId: "gte-rerank-v2@bailian@Tongyi-Qianwen",
});

const retrievalChunkSchema = z.object({
  chunk_id: z.string(),
  document_id: z.string(),
  document_keyword: z.string().optional(),
  content: z.string().optional(),
  content_with_weight: z.string().optional(),
  similarity: z.number().optional(),
  term_similarity: z.number().optional(),
  vector_similarity: z.number().optional(),
  kb_id: z.string().optional(),
  positions: z.array(z.unknown()).optional(),
  image_id: z.string().optional(),
  highlight: z.string().optional(),
});

const retrievalResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z
    .object({
      chunks: z.array(retrievalChunkSchema).default([]),
      total: z.number().optional(),
      doc_aggs: z.array(z.unknown()).optional(),
    })
    .optional(),
});

const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  run: z.string().optional(),
});

const listDocsResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z
    .object({
      docs: z.array(documentSchema).default([]),
      total: z.number().optional(),
    })
    .optional(),
});

export class RagflowApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "RagflowApiError";
  }
}

@Injectable()
export class RagflowClientImpl implements RagflowClient {
  constructor(private readonly config: ConfigService) {}

  async retrieve(params: {
    query: string;
    kbId: string;
    topK?: number;
    docIdWhitelist?: string[];
  }): Promise<Chunk[]> {
    const body: Record<string, unknown> = {
      question: params.query,
      dataset_ids: [params.kbId],
      page: 1,
      page_size: params.topK ?? RETRIEVAL_DEFAULTS.pageSize,
      top_k: RETRIEVAL_DEFAULTS.topK,
      similarity_threshold: RETRIEVAL_DEFAULTS.similarityThreshold,
      vector_similarity_weight: RETRIEVAL_DEFAULTS.vectorSimilarityWeight,
      rerank_id: RETRIEVAL_DEFAULTS.rerankId,
    };
    if (params.docIdWhitelist && params.docIdWhitelist.length > 0) {
      body.doc_ids = params.docIdWhitelist;
    }

    const json = await this.post("/api/v1/retrieval", body);
    const parsed = retrievalResponseSchema.parse(json);
    if (parsed.code !== 0) {
      throw new RagflowApiError(
        `RAGFlow retrieval rejected (code=${parsed.code}): ${parsed.message ?? "unknown"}`,
        200,
      );
    }
    const chunks = parsed.data?.chunks ?? [];
    return chunks.map<Chunk>((c) => ({
      id: c.chunk_id,
      documentId: c.document_id,
      content: c.content_with_weight ?? c.content ?? "",
      score: c.similarity ?? 0,
      metadata: {
        kbId: c.kb_id ?? params.kbId,
        documentKeyword: c.document_keyword,
        termSimilarity: c.term_similarity,
        vectorSimilarity: c.vector_similarity,
        positions: c.positions,
        imageId: c.image_id,
        highlight: c.highlight,
      },
    }));
  }

  // eslint-disable-next-line require-yield
  async *chat(_params: { messages: ChatMessage[]; kbId: string }): AsyncIterable<string> {
    throw new RagflowApiError(
      "RagflowClient.chat is not implemented for the real client. " +
        "Use PAS-orchestrated retrieve + LLM (E2 spec §3.2 mode B) instead.",
      501,
    );
  }

  async graphQuery(_params: {
    entity: string;
    kbId: string;
    hops?: number;
  }): Promise<GraphResult> {
    throw new RagflowApiError(
      "RagflowClient.graphQuery is not implemented. Open a follow-up Issue if needed.",
      501,
    );
  }

  async listDocs(kbId: string): Promise<RagflowDocument[]> {
    const url = new URL(this.resolveUrl(`/api/v1/datasets/${encodeURIComponent(kbId)}/documents`));
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "100");
    const json = await this.fetchJson(url.toString(), { method: "GET" });
    const parsed = listDocsResponseSchema.parse(json);
    if (parsed.code !== 0) {
      throw new RagflowApiError(
        `RAGFlow listDocs rejected (code=${parsed.code}): ${parsed.message ?? "unknown"}`,
        200,
      );
    }
    return (parsed.data?.docs ?? []).map<RagflowDocument>((d) => ({
      id: d.id,
      name: d.name,
      status: d.status ?? d.run ?? "unknown",
    }));
  }

  async uploadDoc(_kbId: string, _file: Buffer, _meta: RagflowDocumentMeta): Promise<string> {
    throw new RagflowApiError(
      "RagflowClient.uploadDoc is not implemented. Documents are managed in RAGFlow console for MVP.",
      501,
    );
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    return this.fetchJson(this.resolveUrl(path), {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async fetchJson(url: string, init: RequestInit): Promise<unknown> {
    const apiKey = this.config.getOrThrow<string>("RAGFLOW_API_KEY");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${apiKey}`);
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch (err) {
      throw new RagflowApiError(
        `RAGFlow network error: ${err instanceof Error ? err.message : String(err)}`,
        0,
      );
    }
    if (!response.ok) {
      const snippet = await this.safeBodySnippet(response);
      throw new RagflowApiError(
        `RAGFlow HTTP ${response.status} on ${init.method ?? "GET"} ${url}`,
        response.status,
        snippet,
      );
    }
    return response.json();
  }

  private resolveUrl(path: string): string {
    const baseUrl = this.config.getOrThrow<string>("RAGFLOW_BASE_URL").replace(/\/$/, "");
    return `${baseUrl}${path}`;
  }

  private async safeBodySnippet(response: Response): Promise<string | undefined> {
    try {
      const text = await response.text();
      return text.slice(0, 200);
    } catch {
      return undefined;
    }
  }
}

@Injectable()
export class RagflowClientMock implements RagflowClient {
  async retrieve(params: Parameters<RagflowClient["retrieve"]>[0]): Promise<Chunk[]> {
    return [
      {
        id: "mock-chunk",
        documentId: "mock-document",
        content: `Mock knowledge for: ${params.query}`,
        score: 1,
        metadata: { kbId: params.kbId, mode: "mock" },
      },
    ];
  }

  async *chat(params: Parameters<RagflowClient["chat"]>[0]): AsyncIterable<string> {
    const question = [...params.messages].reverse().find((m) => m.role === "user")?.content;
    yield `Mock answer for: ${question ?? "empty question"}`;
  }

  async graphQuery(params: Parameters<RagflowClient["graphQuery"]>[0]): Promise<GraphResult> {
    return {
      nodes: [{ id: "mock-node", label: params.entity }],
      edges: [],
    };
  }

  async listDocs(_kbId: string): Promise<RagflowDocument[]> {
    return [{ id: "mock-document", name: "E0 Mock Document", status: "ready" }];
  }

  async uploadDoc(_kbId: string, _file: Buffer, _meta: RagflowDocumentMeta): Promise<string> {
    return "mock-document";
  }
}
