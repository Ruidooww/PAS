import { Inject, Injectable } from "@nestjs/common";

import type { RagflowClient } from "../../clients/ragflow";
import { PUBLIC_RAGFLOW_CLIENT } from "../public-clients.module";

export interface PublicQaAnswer {
  answer: string;
  sources: Array<{ documentId: string; score: number }>;
}

@Injectable()
export class PublicQaService {
  constructor(@Inject(PUBLIC_RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient) {}

  async ask(query: string): Promise<PublicQaAnswer> {
    const chunks = await this.ragflowClient.retrieve({ kbId: "public-kb", query, topK: 3 });
    return {
      answer: `Public mock answer for: ${query}`,
      sources: chunks.map(({ documentId, score }) => ({ documentId, score })),
    };
  }
}
