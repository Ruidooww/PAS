# PAS 阶段边界

本文档定义 PAS V1 / V2 / V3 / V4 的执行边界。Codex 在处理任何 Issue 前，必须同时阅读 `docs/execution/current-phase.md`、`docs/execution/codex-rules.md` 和当前 GitHub Issue。

## 总览

| 阶段 | 目标 | 允许 | 禁止 |
|---|---|---|---|
| 当前 / V1.5 | D2 边界保护 | client interface、NestJS DI、provider adapter、mock impl、guard、`apps/api/src/clients/*` 边界治理 | `PluginManager`、完整 plugin runtime、clients 目录重构、Agent Runtime、Workflow Engine |
| V1 | MVP 闭环 | 简化 AI、Mock client、直接业务流程、证明闭环所需的最小集成 | 完整 RAG 平台、知识图谱、Agent Runtime、Workflow Engine、Plugin Marketplace |
| V2 | Provider adapter hardening | client interface hardening、provider adapter、config switch、可选多 provider 支持、mock impl | Agent Runtime、Planner、Executor、Workflow Engine、强制 `PluginManager` 重构 |
| V3 | Agent 系统 | AgentRuntime、Planner、Executor、Tool Registry、Plugin Registry、agent task state、guarded tool execution | 平台化 Marketplace、多租户平台化、将 tenant isolation 作为通用平台能力 |
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

## 当前 / V1.5: D2 边界保护

当前阶段沿用已经落地的 D2 架构：

```text
Service
  -> NestJS DI
  -> Client Interface
  -> Provider Impl / Mock Impl
```

允许：

- 梳理 provider 调用边界；
- 防止 service 层直连 RAGFlow / FastGPT / OpenAI / LLM / CRM / embedding / vector DB provider；
- 通过 guard 保护 `apps/api/src/clients/*` 作为唯一外部能力薄封装层；
- 增强 client interface / provider adapter / mock impl 的 contract；
- 增强 config switch，但不改变业务 API。

禁止：

- 新增 `PluginManager`；
- 新增完整 plugin runtime；
- 重构 `apps/api/src/clients/*`；
- 把现有 `ragflowClient` / `llmClient` / `crmClient` 迁移到 plugins；
- 改动 service 调用路径；
- 删除或替换现有 D2 client 机制。

## V2: Provider adapter hardening

V2 的目标是在保持现有业务闭环和 D2 client 机制稳定的前提下，让 provider adapter 更可替换、可配置、可测试。当前 V2-prep 应优先表达为 provider adapter hardening，而不是完整 plugin runtime。

允许：

- client interface hardening；
- provider adapter / mock impl hardening；
- config switch；
- 可选多 provider 支持；
- 证明 service code 依赖 client interface 而不是具体 provider 的测试。

禁止：

- 将 `PluginManager` 作为 V1.5 / V2-prep 当前任务；
- 未经明确后续 Issue 要求就新增完整 plugin runtime；
- 将现有 `ragflowClient` / `llmClient` / `crmClient` 迁移到 plugins；
- Agent Runtime；
- Planner / Executor 拆分；
- 自主多步 reasoning loop；
- Workflow Engine；
- 修改现有业务闭环 API contract，除非 Issue 明确声明。

## V3: Agent 系统

V3 在 V2 provider adapter 边界稳定后引入 agent orchestration。`PluginManager` 可以作为 V3 Tool Registry / Plugin Registry 的演进方向，而不是当前阶段硬要求。

允许：

- `AgentRuntime`；
- Planner 和 Executor 角色；
- Tool Registry；
- Plugin Registry；
- guarded tool invocation；
- agent task state、progress、audit event；
- 通过稳定 client interface / provider adapter 使用外部能力。

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

## 未来想法 / 暂定不实施

### 全栈插件化（PluginManager）

**想法**：把所有 AI 能力（LLM / RAG / KB / Embedding / CRM）都统一到 `PluginManager` 之后，通过 config 选择 provider，支持运行时多 provider 共存与路由。

**当前判断**：暂不实施。当前 D2 client interface + NestJS DI + provider adapter 已经满足"换 provider 不动业务层"的可替换性诉求。换 RAGFlow → FastGPT / Dify 的实际代价是新增一个 client 实现 + 改 DI 绑定一行，不需要 PluginManager。

**何时重新评估**（任一满足才考虑落地）：

- **多租户**：不同租户用不同 provider；
- **同一能力运行时多 provider 共存路由**：A/B 测试、按 query 路由、混合调度（如 M6 OPT-M6-02 本地 + 云端调度）；
- **不重启切换**：生产环境改 config 秒级生效；
- **第三方贡献 provider**：marketplace-style 扩展。

**临时折中（V2 Provider adapter hardening 已覆盖）**：

- 强制 client interface 化，业务层只依赖 interface；
- 每个 client 配 MockImpl，保证可无外部依赖测试；
- DI 绑定走 config，启动时按 config 决定具体实现。

**可能的演进切入点**：V3 引入 Agent + Tool Registry 时，Tool Registry 的注册机制可以顺势扩展为 PluginManager；LLM 混合调度需求出现时，先单点引入 `LLMRouter`，不要一次性全栈插件化。

**禁止现在做**：

- 新增 `PluginManager` 类型/接口；
- 把现有 `ragflowClient` / `llmClient` / `crmClient` 包成 plugin；
- 写 plugin lifecycle、动态注册、热加载；
- 任何以"为未来插件化做准备"为由的业务代码重构。

## 边界判定规则

当一个 Issue 同时出现多个阶段的术语时，Codex 只能实现该 Issue 明确要求的最低阶段内容。后续阶段术语可以作为 future scope 记录，但不能提前实现。
