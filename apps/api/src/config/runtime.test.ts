import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadRuntimeConfig, runtimeConfig } from "./runtime";

describe("runtimeConfig", () => {
  it("uses frozen default runtime tuning values", () => {
    const defaultQaTemperature = 0.2;
    const defaultRequirementExtractTemperature = 0;
    const defaultProposalSectionTemperature = 0.2;
    const defaultTemperature = 0.2;

    expect(runtimeConfig.ragflow.retrieval).toEqual({
      pageSize: 30,
      topK: 1024,
      similarityThreshold: 0.1,
      vectorSimilarityWeight: 0.3,
      rerankId: "gte-rerank-v2@bailian@Tongyi-Qianwen",
    });
    expect(runtimeConfig.llm).toEqual({
      qaStream: { temperature: defaultQaTemperature },
      requirementExtract: { temperature: defaultRequirementExtractTemperature },
      proposalSection: { temperature: defaultProposalSectionTemperature },
      defaultTemperature,
    });
    expect(runtimeConfig.qa).toEqual({
      retrievalTopK: 3,
      historyTurns: 5,
    });
    expect(runtimeConfig.proposal.workerConcurrency).toBe(2);
    expect(runtimeConfig.proposal.chapterRetries).toBe(3);
    expect(runtimeConfig.cache.crmTtlSeconds).toBe(300);
    expect(Object.isFrozen(runtimeConfig)).toBe(true);
    expect(Object.isFrozen(runtimeConfig.ragflow.retrieval)).toBe(true);
  });

  it("applies PAS_ environment overrides over defaults", () => {
    const config = loadRuntimeConfig({
      PAS_RAGFLOW_TOP_K: "5",
      PAS_LLM_QA_TEMPERATURE: "0.7",
      PAS_PROPOSAL_WORKER_CONCURRENCY: "4",
      PAS_CACHE_CRM_TTL_SECONDS: "600",
    });

    expect(config.ragflow.retrieval.topK).toBe(5);
    expect(config.ragflow.retrieval.pageSize).toBe(30);
    expect(config.llm.qaStream.temperature).toBe(0.7);
    expect(config.proposal.workerConcurrency).toBe(4);
    expect(config.cache.crmTtlSeconds).toBe(600);
  });

  it("throws a zod error for invalid PAS_ environment overrides", () => {
    expect(() =>
      loadRuntimeConfig({
        PAS_RAGFLOW_TOP_K: "0",
        PAS_LLM_QA_TEMPERATURE: "3",
      }),
    ).toThrowError(ZodError);
  });
});
