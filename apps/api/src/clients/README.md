# Clients — 外部能力薄包装 (D2)

业务代码只依赖本目录定义的 interface，**禁止**直接调用 RAGFlow / FastGPT / LLM 厂家 / CRM 厂家的 SDK 或 HTTP 端点。换供应商时只改本目录。

## 客户端清单

| 文件 | Interface | 提供者注入 token | 实现 |
|---|---|---|---|
| `ragflow.ts` | `RagflowClient` | `RAGFLOW_CLIENT` | `RagflowClientImpl` (REST, `/api/v1/retrieval` + `/api/v1/datasets/:id/documents`) / `RagflowClientMock` |
| `llm.ts` | `LlmClient` | `LLM_CLIENT` | `LlmClientImpl` (OpenAI-compatible) / `LlmClientMock` |
| `crm.ts` | `CrmClient` | `CRM_CLIENT` | `ExternalCrmClient` / `PasCrmClient` (phase 2) / `CrmClientMock` |
| `agent.ts` | `AgentClient` | `AGENT_CLIENT` | **`AgentClientMock` only** (MVP 不调用真实 FastGPT；见下) |

## RAGFlow client 关键事实

- 走 **REST**，不走 MCP。MCP 路径见 [exp-001 决策反转](../../../docs/experiments/exp-001-ragflow-mcp-fastgpt.md) — 留作 v2 候选。
- `retrieve` 默认参数的唯一真源是 `runtimeConfig.ragflow.retrieval`；`RETRIEVAL_DEFAULTS` 继续作为兼容导出（来源：exp-001 实证可用）：
  - `pageSize = 30`
  - `topK = 1024`
  - `similarityThreshold = 0.1`
  - `vectorSimilarityWeight = 0.3`
  - `rerankId = gte-rerank-v2@bailian@Tongyi-Qianwen`
- 调参由 [W1 gate harness Issue #27](https://github.com/Ruidooww/PAS/issues/27) 驱动；**业务层不要覆盖**默认参数。
- 业务层可传 `topK`（覆盖 page_size）和 `docIdWhitelist`（→ RAGFlow `doc_ids` 参数）做 ACL 过滤。
- `chat()` / `graphQuery()` / `uploadDoc()` 在真实 client 里 throw `RagflowApiError(status=501)`——MVP 不需要这些路径（E2 走 mode B = retrieve + LLM）。

## Agent client 关键事实

- **MVP 永远走 Mock**（`ClientsModule` 硬编码 `AgentClientMock`）。决策见 [ADR-001 § 决策修订记录 (2026-06-23)](../../../../PAS%E4%BB%BB%E5%8A%A1%E4%B9%A6-V1.0-20260622/decisions/ADR-001-pas-fastgpt-ragflow.md)。
- 接口 `runWorkflow({ workflowId, inputs, identity })` 强制 `identity = { pasUserId, tenantId, customerId? }`——**即便 mock 也校验**，避免 v2 启用真实 client 时漏 identity 注入。
- 返回 `{ isMock: true, ... }`，下游应处理 mock 输出（不可当真 FastGPT 响应）。
- 首次调用 logger.warn 一次，提示 MVP 未启用真实 FastGPT。

## 环境变量

见根目录 [`.env.example`](../../../../.env.example)。`*_CLIENT_MODE` / `CRM_PROVIDER` 控制 mock vs real 切换；agent 无 env，永远 mock。

## 测试

- `test/*.mock.spec.ts` — mock client 行为
- `test/ragflow.real.spec.ts` — real RagflowClientImpl，用 `vi.stubGlobal('fetch', ...)` mock 上游
- **没有**真实 RAGFlow / FastGPT 集成测试 — 集成测试由 [W3 (#28)](https://github.com/Ruidooww/PAS/issues/28) CI smoke job + [W1 (#27)](https://github.com/Ruidooww/PAS/issues/27) gate harness 覆盖。
