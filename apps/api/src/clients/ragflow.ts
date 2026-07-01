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

import type { SessionClaims } from "../auth/types";
import { runtimeConfig } from "../config/runtime";
import type { PrismaService } from "../prisma/prisma.service";

export const RAGFLOW_CLIENT = Symbol("RAGFLOW_CLIENT");

export type ContentSensitivity = "public" | "internal" | "customer" | "regulated";

export type RagflowAclUserClaims = Omit<SessionClaims, "role"> & {
  role: SessionClaims["role"] | "compliance" | "system_service";
  employment_status?: string | null;
  employmentStatus?: string | null;
};

interface FilterChunksOptions {
  strictMode?: boolean;
  defaultSensitivity?: ContentSensitivity;
}

export interface RagflowClient {
  retrieve(
    params: {
      query: string;
      kbId: string;
      topK?: number;
      docIdWhitelist?: string[];
      similarityThreshold?: number;
    },
    userClaims: RagflowAclUserClaims,
  ): Promise<Chunk[]>;
  chat(params: { messages: ChatMessage[]; kbId: string }): AsyncIterable<string>;
  graphQuery(params: { entity: string; kbId: string; hops?: number }): Promise<GraphResult>;
  listDocs(kbId: string): Promise<RagflowDocument[]>;
  uploadDoc(kbId: string, file: Buffer, meta: RagflowDocumentMeta): Promise<string>;
}

export function filterChunksBySensitivity(
  chunks: Chunk[],
  userClaims: RagflowAclUserClaims,
  options: FilterChunksOptions = {},
): Chunk[] {
  const strictMode = options.strictMode ?? runtimeConfig.acl.contentFilter.strictMode;
  const defaultSensitivity =
    options.defaultSensitivity ?? runtimeConfig.acl.contentFilter.defaultSensitivity;
  return chunks.filter((chunk) => {
    const sensitivity = sensitivityFromChunk(chunk, defaultSensitivity, strictMode);
    return sensitivity !== undefined && canReadSensitivity(sensitivity, userClaims);
  });
}

// exp-001 实证的检索默认参数。调参由 W1 gate harness 驱动，业务层不要覆盖。
export const RETRIEVAL_DEFAULTS = runtimeConfig.ragflow.retrieval;

// RAGFlow HTTP API v1 retrieval response — 官方契约用 `id` + `content`。
// 旧/内部字段名 `chunk_id` + `content_with_weight` 也接受作 fallback（兼容不同
// RAGFlow 版本 / MCP 包装回流的形状），实际真假最终由 W1 (#27) gate harness 校准。
const retrievalChunkSchema = z
  .object({
    id: z.string().optional(),
    chunk_id: z.string().optional(),
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
  })
  .refine((c) => Boolean(c.id ?? c.chunk_id), {
    message: "RAGFlow chunk must have either `id` or `chunk_id`",
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
  size: z.number().int().optional(),
  updatedAt: z.union([z.string(), z.number()]).nullable().optional(),
  updated_at: z.union([z.string(), z.number()]).nullable().optional(),
  update_time: z.union([z.string(), z.number()]).nullable().optional(),
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
  constructor(
    private readonly config: ConfigService,
    private readonly prisma?: Pick<PrismaService, "kbDocument" | "aclAuditLog">,
  ) {}

  async retrieve(params: {
    query: string;
    kbId: string;
    topK?: number;
    docIdWhitelist?: string[];
    similarityThreshold?: number;
  }, userClaims: RagflowAclUserClaims): Promise<Chunk[]> {
    const body: Record<string, unknown> = {
      question: params.query,
      dataset_ids: [params.kbId],
      page: 1,
      page_size: params.topK ?? RETRIEVAL_DEFAULTS.pageSize,
      top_k: RETRIEVAL_DEFAULTS.topK,
      similarity_threshold: params.similarityThreshold ?? RETRIEVAL_DEFAULTS.similarityThreshold,
      vector_similarity_weight: RETRIEVAL_DEFAULTS.vectorSimilarityWeight,
      rerank_id: RETRIEVAL_DEFAULTS.rerankId,
    };
    if (params.docIdWhitelist && params.docIdWhitelist.length > 0) {
      // 官方 HTTP API 字段是 `document_ids`；MCP server 包装的别名 `doc_ids` 不被 HTTP 端识别。
      // 漏掉此字段 = ACL 白名单失效（安全问题）→ 必须用正确字段名。
      body.document_ids = params.docIdWhitelist;
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
    const mapped = chunks.map<Chunk>((c) => ({
      // 官方字段名优先 (`id` / `content`)，旧/MCP 包装别名作 fallback。
      id: (c.id ?? c.chunk_id) as string,
      documentId: c.document_id,
      content: c.content ?? c.content_with_weight ?? "",
      // similarity 缺失时保留 NaN 让调用方分辨 "没分" vs "0分"。
      // (Chunk.score 是 number，不允许 null；NaN 是次优但兼容现有 schema。)
      score: c.similarity ?? Number.NaN,
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
    return this.applyContentAcl(mapped, userClaims);
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
    return (parsed.data?.docs ?? []).map<RagflowDocument>((d) => {
      const document: RagflowDocument = {
        id: d.id,
        name: d.name,
        status: d.status ?? d.run ?? "unknown",
      };
      if (d.size !== undefined) {
        document.size = d.size;
      }
      const updatedAt = d.updatedAt ?? d.updated_at ?? d.update_time;
      if (updatedAt !== undefined && updatedAt !== null) {
        document.updatedAt = coerceIsoTimestamp(updatedAt);
      }
      return document;
    });
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

  private async applyContentAcl(
    chunks: Chunk[],
    userClaims: RagflowAclUserClaims,
  ): Promise<Chunk[]> {
    if (!this.prisma || chunks.length === 0) return chunks;

    const docIds = [...new Set(chunks.map((chunk) => chunk.documentId))];
    const docs = await this.prisma.kbDocument.findMany({
      where: { ragflowDocId: { in: docIds }, deletedAt: null },
      select: {
        ragflowDocId: true,
        sensitivity: true,
        chunkSensitivityMap: true,
      },
    });
    const docById = new Map(docs.map((doc) => [doc.ragflowDocId, doc]));
    const annotated = chunks.map((chunk) => {
      const doc = docById.get(chunk.documentId);
      const sensitivity =
        chunkOverrideSensitivity(doc?.chunkSensitivityMap, chunk.id) ??
        normalizeSensitivity(doc?.sensitivity) ??
        runtimeConfig.acl.contentFilter.defaultSensitivity;
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          sensitivity,
        },
      };
    });
    const allowed = filterChunksBySensitivity(annotated, userClaims);
    const allowedIds = new Set(allowed.map((chunk) => chunk.id));
    const denied = annotated.filter((chunk) => !allowedIds.has(chunk.id));
    if (denied.length > 0) {
      await this.prisma.aclAuditLog.createMany({
        data: denied.map((chunk) => ({
          userId: userClaims.uid,
          resourceType: "kb_document",
          resourceId: chunk.documentId,
          chunkId: chunk.id,
          action: "content_filter",
          reason: `chunk_sensitivity_denied:${String(chunk.metadata.sensitivity)}`,
        })),
      });
    }
    return allowed;
  }
}

function sensitivityFromChunk(
  chunk: Chunk,
  defaultSensitivity: ContentSensitivity,
  strictMode: boolean,
): ContentSensitivity | undefined {
  const sensitivity = normalizeSensitivity(chunk.metadata.sensitivity);
  if (sensitivity) return sensitivity;
  return strictMode ? defaultSensitivity : "public";
}

function normalizeSensitivity(value: unknown): ContentSensitivity | undefined {
  if (
    value === "public" ||
    value === "internal" ||
    value === "customer" ||
    value === "regulated"
  ) {
    return value;
  }
  return undefined;
}

function chunkOverrideSensitivity(
  chunkSensitivityMap: unknown,
  chunkId: string,
): ContentSensitivity | undefined {
  if (
    !chunkSensitivityMap ||
    typeof chunkSensitivityMap !== "object" ||
    Array.isArray(chunkSensitivityMap)
  ) {
    return undefined;
  }
  const value = (chunkSensitivityMap as Record<string, unknown>)[chunkId];
  if (typeof value === "string") return normalizeSensitivity(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeSensitivity((value as Record<string, unknown>).sensitivity);
  }
  return undefined;
}

function canReadSensitivity(
  sensitivity: ContentSensitivity,
  userClaims: RagflowAclUserClaims,
): boolean {
  if (sensitivity === "public") return true;
  if (isInactive(userClaims)) return false;
  if (sensitivity === "regulated") {
    const role = String(userClaims.role);
    return role === "admin" || role === "compliance" || role === "system_service";
  }
  return !userClaims.isExternal && String(userClaims.role) !== "external";
}

function isInactive(userClaims: RagflowAclUserClaims): boolean {
  const status = userClaims.employment_status ?? userClaims.employmentStatus ?? "active";
  return status !== "active";
}

@Injectable()
export class RagflowClientMock implements RagflowClient {
  async retrieve(
    params: Parameters<RagflowClient["retrieve"]>[0],
    _userClaims: Parameters<RagflowClient["retrieve"]>[1],
  ): Promise<Chunk[]> {
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

function coerceIsoTimestamp(value: string | number): string {
  if (typeof value === "string") return value;
  const ms = value < 1e12 ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
