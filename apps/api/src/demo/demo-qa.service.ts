import { Inject, Injectable } from "@nestjs/common";

import { RAGFLOW_CLIENT, type RagflowClient } from "../clients/ragflow";

export interface DemoQaAnswer {
  answer: string;
  sources: Array<{ documentId: string; score: number }>;
}

@Injectable()
export class DemoQaService {
  constructor(@Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient) {}

  async ask(query: string): Promise<DemoQaAnswer> {
    const chunks = await this.ragflowClient.retrieve({ kbId: "e0-mock-kb", query, topK: 3 });
    const answerTokens: string[] = [];

    for await (const token of this.ragflowClient.chat({
      kbId: "e0-mock-kb",
      messages: [{ role: "user", content: query }],
    })) {
      answerTokens.push(token);
    }

    return {
      answer: answerTokens.join(""),
      sources: chunks.map(({ documentId, score }) => ({ documentId, score })),
    };
  }
}
