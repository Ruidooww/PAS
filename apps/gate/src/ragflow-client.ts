// retrieval defaults must match apps/api/src/clients/ragflow.ts RETRIEVAL_DEFAULTS.
// Source of truth: apps/api/src/clients/ragflow.ts. Keep these copied values in sync.
export const RETRIEVAL_DEFAULTS = Object.freeze({
  pageSize: 30,
  topK: 1024,
  similarityThreshold: 0.1,
  vectorSimilarityWeight: 0.3,
  rerankId: "gte-rerank-v2@bailian@Tongyi-Qianwen",
});

export interface RagflowGateClientOptions {
  baseUrl: string;
  apiKey: string;
}

export interface RetrieveParams {
  query: string;
  kbId: string;
  pageSize: number;
  topK: number;
  similarityThreshold: number;
  vectorSimilarityWeight: number;
  rerankId: string | null;
}

export interface GateChunk {
  id: string;
  documentId: string;
  content: string;
  score: number | null;
  documentName: string;
  metadata: Record<string, unknown>;
}

export class RagflowGateClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: RagflowGateClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  async retrieve(params: RetrieveParams): Promise<GateChunk[]> {
    const body: Record<string, unknown> = {
      question: params.query,
      dataset_ids: [params.kbId],
      page: 1,
      page_size: params.pageSize,
      top_k: params.topK,
      similarity_threshold: params.similarityThreshold,
      vector_similarity_weight: params.vectorSimilarityWeight,
    };
    if (params.rerankId) {
      body.rerank_id = params.rerankId;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/retrieval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`RAGFlow retrieval HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const json = (await response.json()) as RagflowRetrievalResponse;
    if (json.code !== 0) {
      throw new Error(`RAGFlow retrieval rejected (code=${json.code}): ${json.message ?? "unknown"}`);
    }

    return (json.data?.chunks ?? []).map((chunk) => ({
      id: chunk.id ?? chunk.chunk_id ?? "",
      documentId: chunk.document_id,
      content: chunk.content ?? chunk.content_with_weight ?? "",
      score: chunk.similarity ?? null,
      documentName:
        chunk.document_name ??
        chunk.doc_name ??
        chunk.document_keyword ??
        chunk.docnm_kwd ??
        chunk.document_id,
      metadata: chunk as unknown as Record<string, unknown>,
    }));
  }
}

interface RagflowRetrievalResponse {
  code: number;
  message?: string;
  data?: {
    chunks?: RagflowChunkResponse[];
  };
}

interface RagflowChunkResponse {
  id?: string;
  chunk_id?: string;
  document_id: string;
  document_name?: string;
  doc_name?: string;
  document_keyword?: string;
  docnm_kwd?: string;
  content?: string;
  content_with_weight?: string;
  similarity?: number;
}
