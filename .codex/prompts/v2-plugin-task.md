# PAS V2 Plugin Task Prompt

此 prompt 用于明确要求 V2 插件化 AI 准备或实现的 PAS Issue。它补充 `.codex/prompts/base-executor.md`，不替代治理文档必读要求。

```text
你是 PAS V2 pluginization 任务的 Codex 执行者。

修改文件前必须阅读：
- docs/execution/current-phase.md
- docs/execution/phase-boundaries.md
- docs/execution/codex-rules.md
- 当前 GitHub Issue body
- 最新 Issue comment 或 orchestrator comment，如果存在

目标阶段：V2 pluginized AI。若 Issue 只要求准备工作，则目标阶段为 V1.5 / V2-prep。

允许范围：
- 定义或收敛 plugin interface。
- 在 Issue 明确要求时添加 PluginManager 或等价 provider-selection boundary。
- 在 Issue 明确要求时添加 RagflowPlugin、FastGPTPlugin、MockRagPlugin、OpenAI adapter、本地模型 adapter 或等价 provider implementation。
- 在 Issue 明确要求时添加 config-based provider selection。
- 添加证明 Service 层依赖 interface 而非具体 provider 的测试。
- 保持现有 business-loop API 行为稳定，除非 Issue 明确要求改变。

禁止范围：
- 不实现 AgentRuntime。
- 不实现 Planner 或 Executor。
- 不实现 Tool Registry。
- 不实现 Workflow Engine。
- 不实现 Plugin Marketplace。
- 不添加多租户平台行为。
- 不修改现有业务闭环 API contract，除非 Issue 明确要求。
- 不在 Service 层直接调用 RAGFlow、FastGPT、OpenAI、embedding provider、vector DB provider 或本地模型 runtime。

设计纪律：
- Service 层只编排应用行为。
- Provider-specific code 只属于 plugin、client、adapter 或 provider infrastructure 层。
- Provider selection 必须通过注入或配置驱动。
- 未确定的外部 AI 行为，在 Issue 要求真实集成前应使用 mock plugin 或 adapter stub 表达。

PR 要求：
- 说明当前阶段，以及 PR 属于 V1.5 / V2-prep 还是 V2。
- 列出改变的 plugin / interface / provider boundary。
- 包含 Boundary Check，证明没有加入 Agent / Workflow / Marketplace 范围。
- 说明 API、DB/schema 和配置影响。
- 提供聚焦测试，或说明该变更是 docs-only。
```

## 边界提醒

V2 plugin work 只到可替换 AI provider 为止，不引入 autonomous agent、workflow orchestration 或 platform marketplace 行为。
