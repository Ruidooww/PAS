import { Inject, Injectable } from "@nestjs/common";

import {
  RAGFLOW_CLIENT,
  type RagflowAclUserClaims,
  type RagflowClient,
} from "../clients/ragflow";
import { runtimeConfig } from "../config/runtime";
import { qaKbId } from "../qa/qa-kb-id";

export interface DemoQaAnswer {
  answer: string;
  sources: Array<{ documentId: string; score: number }>;
}

const demoQaUserClaims: RagflowAclUserClaims = {
  uid: "demo-qa",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "demo-qa",
  name: "Demo QA",
  email: "demo-qa@pas.local",
  role: "system_service",
  isExternal: false,
  deptId: null,
};

@Injectable()
export class DemoQaService {
  constructor(@Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient) {}

  async ask(query: string): Promise<DemoQaAnswer> {
    const kbId = qaKbId();
    const chunks = await this.ragflowClient.retrieve(
      {
        kbId,
        query,
        topK: runtimeConfig.qa.retrievalTopK,
      },
      demoQaUserClaims,
    );
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
