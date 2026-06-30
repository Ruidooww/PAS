import { z } from "zod";

const runtimeSchema = z.object({
  ragflow: z.object({
    retrieval: z.object({
      pageSize: z.number().int().positive(),
      topK: z.number().int().positive(),
      similarityThreshold: z.number().min(0).max(1),
      vectorSimilarityWeight: z.number().min(0).max(1),
      rerankId: z.string().min(1),
    }),
  }),
  llm: z.object({
    qaStream: z.object({ temperature: z.number().min(0).max(2) }),
    requirementExtract: z.object({ temperature: z.number().min(0).max(2) }),
    proposalSection: z.object({ temperature: z.number().min(0).max(2) }),
    defaultTemperature: z.number().min(0).max(2),
  }),
  qa: z.object({
    retrievalTopK: z.number().int().positive(),
    historyTurns: z.number().int().nonnegative(),
  }),
  acl: z.object({
    contentFilter: z.object({
      strictMode: z.boolean(),
      defaultSensitivity: z.enum(["public", "internal", "customer", "regulated"]),
    }),
  }),
  kg: z.object({
    extract: z.object({
      workerConcurrency: z.number().int().positive(),
      attempts: z.number().int().positive(),
      llmTemperature: z.number().min(0).max(2),
    }),
  }),
  proposal: z.object({
    retrievalTopK: z.number().int().positive(),
    workerConcurrency: z.number().int().positive(),
    chapterRetries: z.number().int().nonnegative(),
    queue: z.object({
      removeOnComplete: z.number().int().nonnegative(),
      removeOnFail: z.number().int().nonnegative(),
    }),
  }),
  cache: z.object({
    crmTtlSeconds: z.number().int().positive(),
  }),
  kbSync: z.object({
    enabled: z.boolean(),
    cron: z.string().min(1),
    attempts: z.number().int().positive(),
    workerConcurrency: z.number().int().positive(),
    backoffDelayMs: z.number().int().nonnegative(),
    queue: z.object({
      removeOnComplete: z.number().int().nonnegative(),
      removeOnFail: z.number().int().nonnegative(),
    }),
  }),
});

const defaults = {
  ragflow: {
    retrieval: {
      pageSize: 30,
      topK: 1024,
      similarityThreshold: 0.1,
      vectorSimilarityWeight: 0.3,
      rerankId: "gte-rerank-v2@bailian@Tongyi-Qianwen",
    },
  },
  llm: {
    qaStream: { temperature: 0.2 },
    requirementExtract: { temperature: 0 },
    proposalSection: { temperature: 0.2 },
    defaultTemperature: 0.2,
  },
  qa: {
    retrievalTopK: 3,
    historyTurns: 5,
  },
  acl: {
    contentFilter: {
      strictMode: true,
      defaultSensitivity: "internal",
    },
  },
  kg: {
    extract: {
      workerConcurrency: 1,
      attempts: 3,
      llmTemperature: 0,
    },
  },
  proposal: {
    retrievalTopK: 5,
    workerConcurrency: 2,
    chapterRetries: 3,
    queue: {
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  },
  cache: {
    crmTtlSeconds: 300,
  },
  kbSync: {
    enabled: true,
    cron: "0 * * * *",
    attempts: 3,
    workerConcurrency: 1,
    backoffDelayMs: 1_000,
    queue: {
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  },
} satisfies z.input<typeof runtimeSchema>;

type RuntimeInput = z.input<typeof runtimeSchema>;

const envBindings = [
  ["PAS_RAGFLOW_PAGE_SIZE", ["ragflow", "retrieval", "pageSize"], "number"],
  ["PAS_RAGFLOW_TOP_K", ["ragflow", "retrieval", "topK"], "number"],
  [
    "PAS_RAGFLOW_SIMILARITY_THRESHOLD",
    ["ragflow", "retrieval", "similarityThreshold"],
    "number",
  ],
  [
    "PAS_RAGFLOW_VECTOR_SIMILARITY_WEIGHT",
    ["ragflow", "retrieval", "vectorSimilarityWeight"],
    "number",
  ],
  ["PAS_RAGFLOW_RERANK_ID", ["ragflow", "retrieval", "rerankId"], "string"],
  ["PAS_LLM_QA_TEMPERATURE", ["llm", "qaStream", "temperature"], "number"],
  [
    "PAS_LLM_REQUIREMENT_EXTRACT_TEMPERATURE",
    ["llm", "requirementExtract", "temperature"],
    "number",
  ],
  [
    "PAS_LLM_PROPOSAL_SECTION_TEMPERATURE",
    ["llm", "proposalSection", "temperature"],
    "number",
  ],
  ["PAS_LLM_DEFAULT_TEMPERATURE", ["llm", "defaultTemperature"], "number"],
  ["PAS_QA_RETRIEVAL_TOP_K", ["qa", "retrievalTopK"], "number"],
  ["PAS_QA_HISTORY_TURNS", ["qa", "historyTurns"], "number"],
  ["PAS_ACL_CONTENT_FILTER_STRICT_MODE", ["acl", "contentFilter", "strictMode"], "boolean"],
  [
    "PAS_ACL_CONTENT_FILTER_DEFAULT_SENSITIVITY",
    ["acl", "contentFilter", "defaultSensitivity"],
    "string",
  ],
  [
    "PAS_KG_EXTRACT_WORKER_CONCURRENCY",
    ["kg", "extract", "workerConcurrency"],
    "number",
  ],
  ["PAS_KG_EXTRACT_ATTEMPTS", ["kg", "extract", "attempts"], "number"],
  ["PAS_KG_EXTRACT_LLM_TEMPERATURE", ["kg", "extract", "llmTemperature"], "number"],
  ["PAS_PROPOSAL_RETRIEVAL_TOP_K", ["proposal", "retrievalTopK"], "number"],
  ["PAS_PROPOSAL_WORKER_CONCURRENCY", ["proposal", "workerConcurrency"], "number"],
  ["PAS_PROPOSAL_CHAPTER_RETRIES", ["proposal", "chapterRetries"], "number"],
  [
    "PAS_PROPOSAL_QUEUE_REMOVE_ON_COMPLETE",
    ["proposal", "queue", "removeOnComplete"],
    "number",
  ],
  ["PAS_PROPOSAL_QUEUE_REMOVE_ON_FAIL", ["proposal", "queue", "removeOnFail"], "number"],
  ["PAS_CACHE_CRM_TTL_SECONDS", ["cache", "crmTtlSeconds"], "number"],
  ["PAS_KB_SYNC_ENABLED", ["kbSync", "enabled"], "boolean"],
  ["PAS_KB_SYNC_CRON", ["kbSync", "cron"], "string"],
  ["PAS_KB_SYNC_ATTEMPTS", ["kbSync", "attempts"], "number"],
  ["PAS_KB_SYNC_WORKER_CONCURRENCY", ["kbSync", "workerConcurrency"], "number"],
  ["PAS_KB_SYNC_BACKOFF_DELAY_MS", ["kbSync", "backoffDelayMs"], "number"],
  [
    "PAS_KB_SYNC_QUEUE_REMOVE_ON_COMPLETE",
    ["kbSync", "queue", "removeOnComplete"],
    "number",
  ],
  ["PAS_KB_SYNC_QUEUE_REMOVE_ON_FAIL", ["kbSync", "queue", "removeOnFail"], "number"],
] as const;

type EnvBinding = (typeof envBindings)[number];

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const merged = cloneRuntimeInput(defaults);
  for (const [envKey, path, type] of envBindings) {
    const raw = env[envKey];
    if (raw === undefined) continue;
    setPath(merged, path, parseEnvValue(raw, type));
  }
  return deepFreeze(runtimeSchema.parse(merged));
}

export const runtimeConfig = loadRuntimeConfig();
export type RuntimeConfig = z.infer<typeof runtimeSchema>;

function cloneRuntimeInput(value: RuntimeInput): RuntimeInput {
  return {
    ragflow: {
      retrieval: { ...value.ragflow.retrieval },
    },
    llm: {
      qaStream: { ...value.llm.qaStream },
      requirementExtract: { ...value.llm.requirementExtract },
      proposalSection: { ...value.llm.proposalSection },
      defaultTemperature: value.llm.defaultTemperature,
    },
    qa: { ...value.qa },
    acl: {
      contentFilter: { ...value.acl.contentFilter },
    },
    kg: {
      extract: { ...value.kg.extract },
    },
    proposal: {
      ...value.proposal,
      queue: { ...value.proposal.queue },
    },
    cache: { ...value.cache },
    kbSync: {
      ...value.kbSync,
      queue: { ...value.kbSync.queue },
    },
  };
}

function parseEnvValue(raw: string, type: EnvBinding[2]): unknown {
  if (type === "string") return raw;
  if (type === "boolean") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    return raw;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? raw : Number(trimmed);
}

function setPath(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  let current: Record<string, unknown> = target;
  for (const key of path.slice(0, -1)) {
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]!] = value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}
