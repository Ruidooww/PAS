import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from "@nestjs/common/constants";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditModule } from "../src/audit/audit.module";
import { AuthModule } from "../src/auth/auth.module";
import { InternalAdminModule } from "../src/internal/admin/internal-admin.module";
import { InternalQaModule } from "../src/internal/qa/internal-qa.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { QaModule } from "../src/qa/qa.module";

const completeEnv = {
  APP_BASE_URL: "http://localhost:3001",
  CRM_API_KEY: "test-crm-key",
  CRM_BASE_URL: "https://crm.example.com/api",
  CRM_PROVIDER: "external",
  DATABASE_URL: "postgresql://pas:pas@localhost:5544/pas",
  FEISHU_APP_ID: "cli_test",
  FEISHU_APP_SECRET: "test-feishu-secret",
  FEISHU_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=feishu",
  IDP_MODE: "mock",
  JWT_SECRET: "test-secret-at-least-32-characters-long",
  LLM_API_KEY: "test-llm-key",
  LLM_BASE_URL: "https://llm.example.com/v1",
  LLM_CLIENT_MODE: "mock",
  LLM_MODEL: "test-model",
  MINIO_ACCESS_KEY: "pas",
  MINIO_BUCKET: "pas-dev",
  MINIO_ENDPOINT: "http://localhost:9900",
  MINIO_SECRET_KEY: "test-minio-secret",
  NODE_ENV: "test",
  RAGFLOW_API_KEY: "test-ragflow-key",
  RAGFLOW_BASE_URL: "http://localhost:9380",
  RAGFLOW_CLIENT_MODE: "mock",
  REDIS_URL: "redis://localhost:6399",
  WECOM_AGENT_ID: "1000002",
  WECOM_APP_SECRET: "test-wecom-secret",
  WECOM_CORP_ID: "ww_test",
  WECOM_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=wecom",
};

function metadata<T>(key: string, target: object): T[] {
  return (Reflect.getMetadata(key, target) as T[] | undefined) ?? [];
}

describe("PrismaModule", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("provides one global PrismaService instead of feature-scoped instances", async () => {
    const featureModules = [
      AuthModule,
      AuditModule,
      InternalAdminModule,
      InternalQaModule,
      QaModule,
    ];

    for (const featureModule of featureModules) {
      expect(metadata(MODULE_METADATA.PROVIDERS, featureModule)).not.toContain(PrismaService);
    }

    for (const [key, value] of Object.entries(completeEnv)) vi.stubEnv(key, value);
    const { AppModule } = await import("../src/app.module");
    const prismaModule = metadata<{ name: string }>(MODULE_METADATA.IMPORTS, AppModule).find(
      (moduleType) => moduleType.name === "PrismaModule",
    );
    expect(prismaModule).toBeDefined();
    if (!prismaModule) throw new Error("PrismaModule is not imported by AppModule");

    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, prismaModule)).toBe(true);
    expect(metadata(MODULE_METADATA.PROVIDERS, prismaModule)).toContain(PrismaService);
    expect(metadata(MODULE_METADATA.EXPORTS, prismaModule)).toContain(PrismaService);
  });
});
