# PAS V2 Provider Adapter Task Prompt

此 prompt 用于明确要求 V2 provider adapter hardening 或可选多 provider 支持的 PAS Issue。它补充 `.codex/prompts/base-executor.md`，不替代治理文档必读要求。文件名保留 `v2-plugin-task.md` 是为了沿用 #95 约定，但当前阶段不推进完整 `PluginManager` 架构。

```text
你是 PAS V2 provider adapter hardening 任务的 Codex 执行者。

修改文件前必须阅读：
- docs/execution/current-phase.md
- docs/execution/phase-boundaries.md
- docs/execution/codex-rules.md
- 当前 GitHub Issue body
- 最新 Issue comment 或 orchestrator comment，如果存在

目标阶段：V2 provider adapter hardening。若 Issue 只要求准备工作，则目标阶段为 V1.5 / V2-prep。
当前架构基线：D2 client interface + NestJS DI + provider adapter。

允许范围：
- 定义或收敛 client interface。
- 加固 `apps/api/src/clients/*` 下的 provider adapter / mock impl。
- 在 Issue 明确要求时添加 config switch 或可选多 provider 支持。
- 在 Issue 明确要求时添加 RAGFlow、FastGPT、OpenAI、本地模型或 CRM 的 provider adapter。
- 添加证明 Service 层依赖 interface 而非具体 provider 的测试。
- 保持现有 business-loop API 行为稳定，除非 Issue 明确要求改变。

禁止范围：
- 不新增 PluginManager。
- 不新增完整 plugin runtime。
- 不重构 `apps/api/src/clients/*` 目录。
- 不把现有 `ragflowClient` / `llmClient` / `crmClient` 迁移到 plugins。
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
- Provider-specific code 只属于 client、adapter、mock impl 或 provider infrastructure 层。
- Provider selection 必须通过 NestJS DI 和配置驱动。
- 未确定的外部 AI 行为，在 Issue 要求真实集成前应使用 mock impl 或 adapter stub 表达。

PR 要求：
- 说明当前阶段，以及 PR 属于 V1.5 / V2-prep 还是 V2。
- 列出改变的 client interface / provider adapter / config switch boundary。
- 包含 Boundary Check，证明没有加入 PluginManager / Agent / Workflow / Marketplace 范围。
- 说明 API、DB/schema 和配置影响。
- 提供聚焦测试，或说明该变更是 docs-only。
```

## 边界提醒

当前 V2-prep 只到 provider adapter hardening 和可选多 provider 支持为止，不引入 `PluginManager`、autonomous agent、workflow orchestration 或 platform marketplace 行为。`PluginManager` 可作为 V3 Tool Registry / Plugin Registry 的演进方向，在后续明确 Issue 中再讨论。
