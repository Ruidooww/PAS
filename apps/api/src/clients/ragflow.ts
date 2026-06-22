import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  ChatMessage,
  Chunk,
  GraphResult,
  RagflowDocument,
  RagflowDocumentMeta,
} from "@pas/shared";

export const RAGFLOW_CLIENT = Symbol("RAGFLOW_CLIENT");

export interface RagflowClient {
  retrieve(params: {
    query: string;
    kbId: string;
    topK?: number;
    filters?: Record<string, unknown>;
  }): Promise<Chunk[]>;
  chat(params: { messages: ChatMessage[]; kbId: string }): AsyncIterable<string>;
  graphQuery(params: { entity: string; kbId: string; hops?: number }): Promise<GraphResult>;
  listDocs(kbId: string): Promise<RagflowDocument[]>;
  uploadDoc(kbId: string, file: Buffer, meta: RagflowDocumentMeta): Promise<string>;
}

@Injectable()
export class RagflowClientImpl implements RagflowClient {
  constructor(private readonly config: ConfigService) {}

  retrieve(_params: Parameters<RagflowClient["retrieve"]>[0]): Promise<Chunk[]> {
    return this.notImplemented();
  }

  async *chat(_params: Parameters<RagflowClient["chat"]>[0]): AsyncIterable<string> {
    await this.notImplemented();
    yield "";
  }

  graphQuery(_params: Parameters<RagflowClient["graphQuery"]>[0]): Promise<GraphResult> {
    return this.notImplemented();
  }

  listDocs(_kbId: string): Promise<RagflowDocument[]> {
    return this.notImplemented();
  }

  uploadDoc(_kbId: string, _file: Buffer, _meta: RagflowDocumentMeta): Promise<string> {
    return this.notImplemented();
  }

  private notImplemented<T>(): Promise<T> {
    const baseUrl = this.config.getOrThrow<string>("RAGFLOW_BASE_URL");
    return Promise.reject(
      new Error(`RAGFlow real client contract is not finalized for ${baseUrl}; use mock mode in E0`),
    );
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
    const question = [...params.messages].reverse().find((message) => message.role === "user")?.content;
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
