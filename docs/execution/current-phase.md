# PAS 当前阶段

## 当前阶段

PAS 当前处于 `V1.5 / V2-prep`，执行基线以已落地的 **D2：client interface + NestJS DI + provider adapter** 为准。

这个阶段不是重做 V1，也不是推进完整 `PluginManager` 架构重构。现有 V1 业务闭环和 D2 client 机制视为已经完成的基线能力，后续工作应在现有系统之上做架构收敛、Provider 边界治理和 guard 加固，避免后续 Issue / PR 越级实现 V2、V3 或 V4 能力。

## 阶段目标

`V1.5 / V2-prep` 的目标是保护 D2 边界，让现有系统更容易演进，同时不破坏已经跑通的产品闭环。

当前真实架构应表达为：

```text
Service
  -> NestJS DI
  -> Client Interface
  -> Provider Impl / Mock Impl
```

当前不应表达为：

```text
Service
  -> PluginManager
  -> Plugins
```

当前关注点：

- 保持现有 V1 用户流程可运行；
- 梳理 RAGFlow / FastGPT / OpenAI / LLM / CRM / embedding / vector DB provider 的调用边界；
- 保护 `apps/api/src/clients/*` 作为唯一外部能力薄封装层；
- 通过 NestJS DI 将 service 层约束在 client interface 之后；
- 将直接 provider 知识收敛到 client interface / provider adapter / mock impl 边界之后；
- 增加 guard 检查和 Codex 执行规则；
- 为 V2 provider adapter hardening 做准备；
- 不提前引入 Agent Runtime、Workflow Engine 或平台化 Marketplace 行为。

## 当前允许

Codex 只有在当前 GitHub Issue 明确要求时，才可以做以下事项：

- 梳理 RAGFlow / FastGPT / OpenAI / 本地模型调用边界；
- 把 service 层直接 provider 调用收敛到 `apps/api/src/clients/*` 下的 client interface / provider adapter；
- 增加 client boundary guard、config switch 或 boundary check；
- 增加 Codex 执行规则、prompt、checklist 和治理文档；
- 保持现有 API、UI、worker、export 等功能可运行；
- 在实现任务明确要求时，为边界规则增加聚焦测试。

## 当前禁止

Codex 不允许做以下事项：

- 重写 V1 主业务链路；
- 删除已完成的 V1 业务能力；
- 在 service 层继续写死 RAGFlow / FastGPT / OpenAI / LLM / CRM / embedding / vector DB provider 调用；
- 新增 `PluginManager` 或完整 plugin runtime；
- 重构 `apps/api/src/clients/*` 目录；
- 把现有 `ragflowClient` / `llmClient` / `crmClient` 迁移到 plugins；
- 删除、替换或绕过现有 D2 client 机制；
- 提前实现 V3 Agent Runtime、Planner、Executor、Tool Registry 或自主 agent planning；
- 提前实现 V4 平台化、多租户隔离、Plugin Marketplace 或 Workflow Engine；
- 将 governance-only Issue 扩展成业务代码、schema、真实 RAG、Agent、Workflow 或 provider runtime 实现。

## 业务输入文档准入规则

业务输入文档（`docs/spec/*.md` 形态）会被用作后续工程 Issue 的解锁依据。为防止"高质量业务 spec 静默扩张路线图范围"，准入受以下规则约束：

### 受控范围

以下模块及其子任务的业务输入文档必须先经业务方显式签字确认"该模块进入当前路线"，Codex 才能写 spec：

- 任务书 §6.1 明确砍掉的模块：M3 会议、M4 合同与财务、M8 多渠道、M10 Agent 编排、M11 经营驾驶舱、M12 渠道管理、M15 客情系统、客服 Agent；
- 远期模块的高阶能力：M7 知识图谱、M9.2 ABAC engine、M9.3 项目组隔离 runtime、M14.2 PPT 引擎、M14.3 规则 DSL、M14.4 Outcome Learning / LoRA。

### 签字确认要求

业务方在对应 GitHub Issue 评论区给出明确签字（例如「确认该模块进入 V1.5 / V2 路线」），并在 Issue body 顶部加 `phase:` 标签后，Codex 才能起草业务输入文档。

未签字时 Codex 必须：

- 不主动起草业务输入文档；
- 不把已有 spec 推进到后续阶段；
- 在 Issue 中显式说明"等待业务方路线确认"。

### Spec 不等于解锁

业务输入文档合并 ≠ 后续工程 Issue 解锁。每个工程 Issue 仍需独立的解锁条件（业务/合规/售前主管/合规分级确认），spec body 顶部必须列明本文档解锁哪些 Issue、不解锁哪些 Issue。

### 签字代理（agent-signed）vs 真签字（human-signed）

当业务方授权 Codex 代理扮演业务负责人 / 安全合规 / 资深售前 / 法务等角色完成 spec 签字时，spec 必须显式区分签字类型：

- `[agent-signed]`：由 Codex 代理签字，仅作为草稿推进依据。
- `[human-signed by <人名或角色>, <日期>]`：真业务方在 GitHub Issue 评论区独立签字。

签字解锁分两阶段：

- **阶段 A（agent-signed 完成）**：spec 可合并为草稿、可作为后续工程 Issue 的"准备实施"输入；**不解锁工程实施 PR**。
- **阶段 B（human-signed 完成）**：才解锁工程实施 PR。

要求：

- 任何业务输入 spec body 顶部必须有「签字状态总览」小节，逐项列出签字方、签字类型、签字日期。
- Codex 代理签字时必须显式声明哪些真实角色尚未接入，不得用"已确认"模糊表述。
- 工程实施 Issue 的解锁条件检查必须显式区分 agent-signed 和 human-signed；只 agent-signed 不构成解锁。
- 若 spec 内文出现"已确认"等表述但实际为 agent-signed，PR 必须在签字状态总览中显式回溯标注。

## 执行规则

每个 PR 都必须说明当前阶段，并基于本文档做 Boundary Check。若 Issue 请求看起来跨入后续阶段，Codex 必须停止实现路径，在 Issue 或 PR 中说明边界冲突，不能静默越级实现。
