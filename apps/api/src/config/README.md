# Runtime Config

`apps/api/src/config/runtime.ts` is the single source for runtime tuning defaults. Every override uses the `PAS_` prefix and is optional; invalid values fail startup through `zod`.

| Field | Env override | Default | Tuning impact |
| --- | --- | --- | --- |
| `ragflow.retrieval.pageSize` | `PAS_RAGFLOW_PAGE_SIZE` | `30` | More retrieved chunks can increase latency and payload size. |
| `ragflow.retrieval.topK` | `PAS_RAGFLOW_TOP_K` | `1024` | Broader candidate search can improve recall but costs more retrieval time. |
| `ragflow.retrieval.similarityThreshold` | `PAS_RAGFLOW_SIMILARITY_THRESHOLD` | `0.1` | Higher values reduce low-similarity chunks and may lower recall. |
| `ragflow.retrieval.vectorSimilarityWeight` | `PAS_RAGFLOW_VECTOR_SIMILARITY_WEIGHT` | `0.3` | Changes keyword/vector balance in RAGFlow retrieval. |
| `ragflow.retrieval.rerankId` | `PAS_RAGFLOW_RERANK_ID` | `gte-rerank-v2@bailian@Tongyi-Qianwen` | Changes reranker behavior and provider dependency. |
| `llm.qaStream.temperature` | `PAS_LLM_QA_TEMPERATURE` | `0.2` | Higher values make QA less deterministic. |
| `llm.requirementExtract.temperature` | `PAS_LLM_REQUIREMENT_EXTRACT_TEMPERATURE` | `0` | Keep low for JSON extraction stability. |
| `llm.proposalSection.temperature` | `PAS_LLM_PROPOSAL_SECTION_TEMPERATURE` | `0.2` | Higher values make proposal prose more varied. |
| `llm.defaultTemperature` | `PAS_LLM_DEFAULT_TEMPERATURE` | `0.2` | Fallback for direct `LlmClient` calls without a caller-specific temperature. |
| `qa.retrievalTopK` | `PAS_QA_RETRIEVAL_TOP_K` | `3` | Controls QA page-size override before ACL filtering. |
| `qa.historyTurns` | `PAS_QA_HISTORY_TURNS` | `5` | More history improves follow-up context but increases prompt size. |
| `proposal.retrievalTopK` | `PAS_PROPOSAL_RETRIEVAL_TOP_K` | `5` | Controls proposal section retrieval breadth. |
| `proposal.workerConcurrency` | `PAS_PROPOSAL_WORKER_CONCURRENCY` | `2` | Higher concurrency improves throughput but increases Redis/LLM load. |
| `proposal.chapterRetries` | `PAS_PROPOSAL_CHAPTER_RETRIES` | `3` | More retries improve resilience but can increase LLM cost. |
| `proposal.queue.removeOnComplete` | `PAS_PROPOSAL_QUEUE_REMOVE_ON_COMPLETE` | `100` | Retains recent completed BullMQ jobs for inspection. |
| `proposal.queue.removeOnFail` | `PAS_PROPOSAL_QUEUE_REMOVE_ON_FAIL` | `100` | Retains recent failed BullMQ jobs for inspection. |
| `cache.crmTtlSeconds` | `PAS_CACHE_CRM_TTL_SECONDS` | `300` | Longer TTL reduces CRM load but may serve staler CRM data. |
| `kbSync.enabled` | `PAS_KB_SYNC_ENABLED` | `true` | Disables scheduled KB sync when `false`. |
| `kbSync.cron` | `PAS_KB_SYNC_CRON` | `0 * * * *` | Controls scheduled KB sync cadence. |
| `kbSync.attempts` | `PAS_KB_SYNC_ATTEMPTS` | `3` | More attempts improve sync resilience but keep jobs active longer. |
| `kbSync.workerConcurrency` | `PAS_KB_SYNC_WORKER_CONCURRENCY` | `1` | Keep at `1` unless duplicate sync work is safe. |
| `kbSync.backoffDelayMs` | `PAS_KB_SYNC_BACKOFF_DELAY_MS` | `1000` | Initial retry backoff delay for failed sync jobs. |
| `kbSync.queue.removeOnComplete` | `PAS_KB_SYNC_QUEUE_REMOVE_ON_COMPLETE` | `100` | Retains recent completed sync jobs for inspection. |
| `kbSync.queue.removeOnFail` | `PAS_KB_SYNC_QUEUE_REMOVE_ON_FAIL` | `100` | Retains recent failed sync jobs for inspection. |
