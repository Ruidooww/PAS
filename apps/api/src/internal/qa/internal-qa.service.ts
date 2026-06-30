import { Inject, Injectable } from "@nestjs/common";

import type { SessionClaims } from "../../auth/types";
import { RAGFLOW_CLIENT, type RagflowClient } from "../../clients/ragflow";
import { runtimeConfig } from "../../config/runtime";
import { qaKbId } from "../../qa/qa-kb-id";
import { AclService } from "../acl.service";

export interface InternalQaAnswer {
  answer: string;
  sources: Array<{ documentId: string; score: number }>;
}

@Injectable()
export class InternalQaService {
  constructor(
    @Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient,
    @Inject(AclService) private readonly acl: AclService,
  ) {}

  async ask(query: string, user: SessionClaims): Promise<InternalQaAnswer> {
    const visibleDocIds = await this.acl.computeVisibleDocIds(user);
    if (visibleDocIds.length === 0) return { answer: "", sources: [] };
    const kbId = qaKbId();
    const retrievedChunks = await this.ragflowClient.retrieve(
      {
        kbId,
        query,
        topK: runtimeConfig.qa.retrievalTopK,
        docIdWhitelist: visibleDocIds,
      },
      user,
    );
    const allowedDocIds = new Set(visibleDocIds);
    const chunks = retrievedChunks.filter((chunk) => allowedDocIds.has(chunk.documentId));
    const answerTokens: string[] = [];

    for await (const token of this.ragflowClient.chat({
      kbId,
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

