import { Inject, Injectable } from "@nestjs/common";

import type { RagflowAclUserClaims, RagflowClient } from "../../clients/ragflow";
import { runtimeConfig } from "../../config/runtime";
import { PUBLIC_RAGFLOW_CLIENT } from "../public-clients.module";
import { redactExternalAnswer } from "./redact-answer";

export interface PublicQaAnswer {
  answer: string;
  sources: Array<{ documentId: string; score: number }>;
}

const publicQaUserClaims: RagflowAclUserClaims = {
  uid: "public-qa",
  tenantId: "public",
  idpProvider: "mock",
  idpUserId: "public-qa",
  name: "Public QA",
  email: "public-qa@pas.local",
  role: "external",
  isExternal: true,
  deptId: null,
};

@Injectable()
export class PublicQaService {
  constructor(@Inject(PUBLIC_RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient) {}

  async ask(query: string): Promise<PublicQaAnswer> {
    const chunks = await this.ragflowClient.retrieve(
      {
        kbId: "public-kb",
        query,
        topK: runtimeConfig.qa.retrievalTopK,
      },
      publicQaUserClaims,
    );
    return {
      answer: redactExternalAnswer(`Public mock answer for: ${query}`),
      sources: chunks.map(({ documentId, score }) => ({ documentId, score })),
    };
  }
}
