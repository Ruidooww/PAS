import { describe, expect, it } from "vitest";

import { validateEnv } from "../src/config/env.schema";

const completeEnv = {
  APP_BASE_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://pas:pas@localhost:5544/pas",
  CRM_API_KEY: "test-crm-key",
  CRM_BASE_URL: "https://crm.example.com/api",
  JWT_SECRET: "test-secret-at-least-32-characters-long",
  IDP_MODE: "mock",
  FEISHU_APP_ID: "cli_test",
  FEISHU_APP_SECRET: "test-feishu-secret",
  FEISHU_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=feishu",
  LLM_API_KEY: "test-llm-key",
  LLM_BASE_URL: "https://llm.example.com/v1",
  LLM_CLIENT_MODE: "mock",
  LLM_MODEL: "test-model",
  MINIO_ACCESS_KEY: "pas",
  MINIO_BUCKET: "pas-dev",
  MINIO_ENDPOINT: "http://localhost:9900",
  MINIO_SECRET_KEY: "test-minio-secret",
  PAS_KB_ID: "proposal-kb",
  RAGFLOW_API_KEY: "test-ragflow-key",
  RAGFLOW_BASE_URL: "http://localhost:9380",
  RAGFLOW_CLIENT_MODE: "mock",
  REDIS_URL: "redis://localhost:6399",
  CRM_PROVIDER: "external",
  WECOM_AGENT_ID: "1000002",
  WECOM_APP_SECRET: "test-wecom-secret",
  WECOM_CORP_ID: "ww_test",
  WECOM_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=wecom",
};

describe("validateEnv", () => {
  it("accepts a complete E0 environment", () => {
    expect(validateEnv(completeEnv)).toMatchObject({
      ...completeEnv,
      PAS_KG_EXTRACT_ATTEMPTS: 3,
      PAS_KG_EXTRACT_LLM_TEMPERATURE: 0,
      PAS_KG_EXTRACT_WORKER_CONCURRENCY: 1,
      PAS_ACL_CONTENT_FILTER_DEFAULT_SENSITIVITY: "internal",
      PAS_ACL_CONTENT_FILTER_STRICT_MODE: true,
      PAS_KB_SYNC_CRON: "0 * * * *",
      PAS_KB_SYNC_ENABLED: true,
    });
  });

  it("parses KG extraction overrides", () => {
    expect(
      validateEnv({
        ...completeEnv,
        PAS_KG_EXTRACT_ATTEMPTS: "5",
        PAS_KG_EXTRACT_LLM_TEMPERATURE: "0.1",
        PAS_KG_EXTRACT_WORKER_CONCURRENCY: "2",
      }),
    ).toMatchObject({
      PAS_KG_EXTRACT_ATTEMPTS: 5,
      PAS_KG_EXTRACT_LLM_TEMPERATURE: 0.1,
      PAS_KG_EXTRACT_WORKER_CONCURRENCY: 2,
    });
  });

  it("parses kb sync scheduling overrides", () => {
    expect(
      validateEnv({
        ...completeEnv,
        PAS_KB_SYNC_CRON: "*/15 * * * *",
        PAS_KB_SYNC_ENABLED: "false",
      }),
    ).toMatchObject({
      PAS_KB_SYNC_CRON: "*/15 * * * *",
      PAS_KB_SYNC_ENABLED: false,
    });
  });

  it("parses ACL content filter overrides", () => {
    expect(
      validateEnv({
        ...completeEnv,
        PAS_ACL_CONTENT_FILTER_DEFAULT_SENSITIVITY: "public",
        PAS_ACL_CONTENT_FILTER_STRICT_MODE: "false",
      }),
    ).toMatchObject({
      PAS_ACL_CONTENT_FILTER_DEFAULT_SENSITIVITY: "public",
      PAS_ACL_CONTENT_FILTER_STRICT_MODE: false,
    });
  });

  it("rejects a missing required variable", () => {
    const incompleteEnv: Partial<typeof completeEnv> = { ...completeEnv };
    delete incompleteEnv.DATABASE_URL;

    expect(() => validateEnv(incompleteEnv)).toThrow(/DATABASE_URL/);
  });

  it("requires APP_BASE_URL as the canonical OAuth origin", () => {
    const incompleteEnv: Partial<typeof completeEnv> = { ...completeEnv };
    delete incompleteEnv.APP_BASE_URL;

    expect(() => validateEnv(incompleteEnv)).toThrow(/APP_BASE_URL/);
  });

  it("requires PAS_KB_ID for proposal retrieval", () => {
    const incompleteEnv: Partial<typeof completeEnv> = { ...completeEnv };
    delete incompleteEnv.PAS_KB_ID;

    expect(() => validateEnv(incompleteEnv)).toThrow(/PAS_KB_ID/);
  });

  it("rejects an unsupported CRM provider", () => {
    expect(() => validateEnv({ ...completeEnv, CRM_PROVIDER: "vendor-x" })).toThrow(
      /CRM_PROVIDER/,
    );
  });

  it("rejects mock IdP mode in production", () => {
    expect(() => validateEnv({ ...completeEnv, IDP_MODE: "mock", NODE_ENV: "production" })).toThrow(
      /IDP_MODE=mock/,
    );
  });

  it("rejects placeholder LLM API keys in real mode", () => {
    expect(() =>
      validateEnv({
        ...completeEnv,
        LLM_CLIENT_MODE: "real",
        LLM_API_KEY: "local-placeholder",
      }),
    ).toThrow(/LLM_API_KEY looks like a placeholder in real mode/);
  });

  it("rejects placeholder RAGFlow API keys in real mode", () => {
    expect(() =>
      validateEnv({
        ...completeEnv,
        RAGFLOW_CLIENT_MODE: "real",
        RAGFLOW_API_KEY: "ragflow-placeholder",
      }),
    ).toThrow(/RAGFLOW_API_KEY looks like a placeholder in real mode/);
  });

  it("allows local placeholder keys when the matching clients run in mock mode", () => {
    expect(
      validateEnv({
        ...completeEnv,
        LLM_CLIENT_MODE: "mock",
        LLM_API_KEY: "local-placeholder",
        RAGFLOW_CLIENT_MODE: "mock",
        RAGFLOW_API_KEY: "local-ragflow",
      }),
    ).toMatchObject({
      LLM_CLIENT_MODE: "mock",
      RAGFLOW_CLIENT_MODE: "mock",
    });
  });
});
