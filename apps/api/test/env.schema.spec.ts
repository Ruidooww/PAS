import { describe, expect, it } from "vitest";

import { validateEnv } from "../src/config/env.schema";

const completeEnv = {
  DATABASE_URL: "postgresql://pas:pas@localhost:5544/pas",
  CRM_API_KEY: "test-crm-key",
  CRM_BASE_URL: "https://crm.example.com/api",
  JWT_SECRET: "test-secret-at-least-32-characters-long",
  LLM_API_KEY: "test-llm-key",
  LLM_BASE_URL: "https://llm.example.com/v1",
  LLM_CLIENT_MODE: "mock",
  LLM_MODEL: "test-model",
  MINIO_ACCESS_KEY: "pas",
  MINIO_BUCKET: "pas-dev",
  MINIO_ENDPOINT: "http://localhost:9900",
  MINIO_SECRET_KEY: "test-minio-secret",
  RAGFLOW_API_KEY: "test-ragflow-key",
  RAGFLOW_BASE_URL: "http://localhost:9380",
  RAGFLOW_CLIENT_MODE: "mock",
  REDIS_URL: "redis://localhost:6399",
  CRM_PROVIDER: "external",
};

describe("validateEnv", () => {
  it("accepts a complete E0 environment", () => {
    expect(validateEnv(completeEnv)).toMatchObject(completeEnv);
  });

  it("rejects a missing required variable", () => {
    const incompleteEnv: Partial<typeof completeEnv> = { ...completeEnv };
    delete incompleteEnv.DATABASE_URL;

    expect(() => validateEnv(incompleteEnv)).toThrow(/DATABASE_URL/);
  });

  it("rejects an unsupported CRM provider", () => {
    expect(() => validateEnv({ ...completeEnv, CRM_PROVIDER: "vendor-x" })).toThrow(
      /CRM_PROVIDER/,
    );
  });
});
