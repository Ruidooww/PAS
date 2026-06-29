# PAS 阶段边界

本文档定义 PAS V1 / V2 / V3 / V4 的执行边界。Codex 在处理任何 Issue 前，必须同时阅读 `docs/execution/current-phase.md`、`docs/execution/codex-rules.md` 和当前 GitHub Issue。

## 总览

| 阶段 | 目标 | 允许 | 禁止 |
|---|---|---|---|
| V1 | MVP 闭环 | 简化 AI、Mock client、直接业务流程、证明闭环所需的最小集成 | 完整 RAG 平台、知识图谱、Agent Runtime、Workflow Engine、Plugin Marketplace |
| V2 | 插件化 AI | LLM / RAG / KB / Embedding plugin interface、provider adapter、config-based provider selection、mock plugin | Agent Runtime、Planner、Executor、Workflow Engine |
| V3 | Agent 系统 | AgentRuntime、Planner、Executor、Tool Registry、agent task state、guarded tool execution | 平台化 Marketplace、多租户平台化、将 tenant isolation 作为通用平台能力 |
| V4 | 平台化 | Multi-Agent、Workflow Engine、Plugin Registry、Tenant Isolation、平台治理和生命周期管理 | 绕过阶段规则的直接 provider 耦合或临时平台功能 |

## V1: MVP 闭环

V1 的目标是用最小可靠实现证明 PAS 主流程可以端到端跑通。

允许：

- 简化 AI 行为；
- 对不确定外部系统使用 mock 或 stub client；
- 为 MVP 必需的直接业务流程；
- 当前 V1 Issue 明确要求时的最小 RAGFlow / FastGPT / provider 集成；
- 保护 MVP 闭环的测试和 guard。

禁止：

- 完整 RAG 平台实现；
- 知识图谱实现；
- Agent Runtime、Planner、Executor、Tool Registry 或自主 agent 行为；
- Workflow Engine；
- Plugin Marketplace；
- 与保持 V1 稳定无关的大范围 provider 抽象。

## V2: 插件化 AI

V2 的目标是在保持现有业务闭环稳定的前提下，让 AI provider 可替换、可配置、可测试。

允许：

- `LlmPlugin`、`RagPlugin`、`KbPlugin`、`EmbeddingPlugin` 或等价 provider interface；
- `PluginManager` 或等价 provider selection 编排边界；
- `RagflowPlugin`、`FastGPTPlugin`、`MockRagPlugin`、OpenAI adapter、本地模型 adapter 或等价实现类；
- config-based provider selection；
- 证明 service code 依赖 interface 而不是具体 provider 的测试。

禁止：

- Agent Runtime；
- Planner / Executor 拆分；
- 自主多步 reasoning loop；
- Workflow Engine；
- 修改现有业务闭环 API contract，除非 Issue 明确声明。

## V3: Agent 系统

V3 在 V2 provider 边界稳定后引入 agent orchestration。

允许：

- `AgentRuntime`；
- Planner 和 Executor 角色；
- Tool Registry；
- guarded tool invocation；
- agent task state、progress、audit event；
- 通过稳定 interface 使用 V2 plugin。

禁止：

- 平台 Marketplace 行为；
- 多租户平台化；
- 将 tenant isolation 做成通用平台产品能力；
- 绕过 V2 plugin 边界，在 agent 中直接调用具体 provider。

## V4: 平台化

V4 将 PAS 演进为受治理的平台层。

允许：

- Multi-Agent orchestration；
- Workflow Engine；
- Plugin Registry；
- Tenant Isolation；
- 平台管理、治理和生命周期控制；
- Issue 明确要求时的 marketplace-style provider 或 workflow 管理。

禁止：

- service、agent 或 workflow 层直接耦合 provider；
- 不遵循 V2 / V3 contract 的临时平台功能；
- 未经 Issue 明确声明和 PR 披露就静默改变 API、DB、schema 或配置 contract。

## 边界判定规则

当一个 Issue 同时出现多个阶段的术语时，Codex 只能实现该 Issue 明确要求的最低阶段内容。后续阶段术语可以作为 future scope 记录，但不能提前实现。
