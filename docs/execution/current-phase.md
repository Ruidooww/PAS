# PAS 当前阶段

## 当前阶段

PAS 当前处于 `V1.5 / V2-prep`。

这个阶段不是重做 V1。现有 V1 业务闭环视为已经完成的基线能力，后续工作应在现有系统之上做架构收敛、Provider 边界治理和插件化准备，避免后续 Issue / PR 越级实现 V2、V3 或 V4 能力。

## 阶段目标

`V1.5 / V2-prep` 的目标是让现有系统更容易演进，同时不破坏已经跑通的产品闭环。

当前关注点：

- 保持现有 V1 用户流程可运行；
- 梳理 RAGFlow / FastGPT / OpenAI / embedding / vector DB provider 的调用边界；
- 将直接 provider 知识收敛到 interface / adapter / plugin / client 边界之后；
- 增加 guard 检查和 Codex 执行规则；
- 为 V2 插件化 AI 做准备；
- 不提前引入 Agent Runtime、Workflow Engine 或平台化 Marketplace 行为。

## 当前允许

Codex 只有在当前 GitHub Issue 明确要求时，才可以做以下事项：

- 梳理 RAGFlow / FastGPT / OpenAI / 本地模型调用边界；
- 把直接 provider 调用改成 interface / adapter / plugin / client 边界；
- 增加 provider selection 或 boundary guard 检查；
- 增加 Codex 执行规则、prompt、checklist 和治理文档；
- 保持现有 API、UI、worker、export 等功能可运行；
- 在实现任务明确要求时，为边界规则增加聚焦测试。

## 当前禁止

Codex 不允许做以下事项：

- 重写 V1 主业务链路；
- 删除已完成的 V1 业务能力；
- 在 service 层继续写死 RAGFlow / FastGPT / OpenAI / embedding / vector DB provider 调用；
- 提前实现 V3 Agent Runtime、Planner、Executor、Tool Registry 或自主 agent planning；
- 提前实现 V4 平台化、多租户隔离、Plugin Marketplace 或 Workflow Engine；
- 将 governance-only Issue 扩展成业务代码、schema、真实 RAG、Agent、Workflow 或 provider runtime 实现。

## 执行规则

每个 PR 都必须说明当前阶段，并基于本文档做 Boundary Check。若 Issue 请求看起来跨入后续阶段，Codex 必须停止实现路径，在 Issue 或 PR 中说明边界冲突，不能静默越级实现。
