import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import type { Agent } from "supertest";

export interface E2eContext {
  app: INestApplication;
  agent: Agent;
  prisma: PrismaClient;
  close(): Promise<void>;
}

const e2eEnv = {
  APP_BASE_URL: "http://localhost:3001",
  CRM_API_KEY: "e2e-crm-key",
  CRM_BASE_URL: "https://crm.example.com/api",
  CRM_PROVIDER: "mock",
  DATABASE_URL:
    process.env.PAS_E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://pas:pas@localhost:5544/pas",
  FEISHU_APP_ID: "cli_e2e",
  FEISHU_APP_SECRET: "e2e-feishu-secret",
  FEISHU_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=feishu",
  IDP_MODE: "mock",
  JWT_SECRET: "e2e-secret-at-least-32-characters-long",
  LLM_API_KEY: "e2e-llm-key",
  LLM_BASE_URL: "https://llm.example.com/v1",
  LLM_CLIENT_MODE: "mock",
  LLM_MODEL: "e2e-model",
  MINIO_ACCESS_KEY: "pas",
  MINIO_BUCKET: "pas-dev",
  MINIO_ENDPOINT: "http://localhost:9900",
  MINIO_SECRET_KEY: "e2e-minio-secret",
  NODE_ENV: "development",
  PAS_KB_ID: "proposal-kb",
  QA_KB_ID: "e2e-qa-kb",
  RAGFLOW_API_KEY: "e2e-ragflow-key",
  RAGFLOW_BASE_URL: "http://localhost:9380",
  RAGFLOW_CLIENT_MODE: "mock",
  REDIS_URL: process.env.PAS_E2E_REDIS_URL ?? process.env.REDIS_URL ?? "redis://localhost:6399",
  WECOM_AGENT_ID: "1000002",
  WECOM_APP_SECRET: "e2e-wecom-secret",
  WECOM_CORP_ID: "ww_e2e",
  WECOM_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=wecom",
};

export async function bootstrapE2e(): Promise<E2eContext> {
  Object.assign(process.env, e2eEnv);
  const [{ AppModule }, { PrismaService }] = await Promise.all([
    import("../../api/src/app.module"),
    import("../../api/src/prisma/prisma.service"),
  ]);
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const prisma = app.get(PrismaService) as PrismaClient;
  const agent = request.agent(app.getHttpServer());

  return {
    app,
    agent,
    prisma,
    async close() {
      await app.close();
    },
  };
}

export async function seedVisibleKnowledgeDocument(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.kbDocument.upsert({
    where: { ragflowDocId: "mock-document" },
    create: {
      ragflowDocId: "mock-document",
      ragflowKbId: "e2e-qa-kb",
      name: "E2E Mock Document",
      product: "IP-Guard",
      aclScope: "internal",
      uploadedBy: userId,
    },
    update: {
      ragflowKbId: "e2e-qa-kb",
      name: "E2E Mock Document",
      product: "IP-Guard",
      aclScope: "internal",
      uploadedBy: userId,
    },
  });
}

export async function resetE2eData(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.conversationFeedback.deleteMany({ where: { userId } });
  await prisma.message.deleteMany({ where: { conversation: { userId } } });
  await prisma.conversation.deleteMany({ where: { userId } });
  await prisma.proposalVersion.deleteMany({
    where: { proposal: { createdBy: userId } },
  });
  await prisma.proposal.deleteMany({ where: { createdBy: userId } });
  await prisma.kbDocument.deleteMany({
    where: { uploadedBy: userId, ragflowDocId: "mock-document" },
  });
  await prisma.auditLog.deleteMany({ where: { userId } });
}
