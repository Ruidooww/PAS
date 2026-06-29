# PAS Codex 执行规则

本文档约束 Codex 在 PAS 仓库中的 Issue 执行和 PR 交付行为。

## 执行前必读

修改文件前，Codex 必须阅读：

- `docs/execution/current-phase.md`；
- `docs/execution/phase-boundaries.md`；
- `docs/execution/codex-rules.md`；
- 当前 GitHub Issue body；
- 最新 Issue comment 或 orchestrator comment，如果存在。

如果 comment 收窄或覆盖 Issue body，以最新适用 comment 作为执行合同。

## 范围纪律

Codex 必须：

- 只实现当前 Issue 明确要求的内容；
- 保持 diff 限定在声明范围内；
- 避免无关重构、格式化噪音、依赖变更和顺手清理；
- 保留已经完成的业务能力；
- 当 Issue 请求跨越当前阶段边界时，停止实现并报告边界冲突。

Codex 不允许：

- 越级实现后续阶段能力；
- 将 governance-only Issue 扩展成 runtime implementation；
- 修改 API、DB、schema、配置或 UI contract，除非 Issue 明确要求；
- 留下临时 mock、debug output、TODO 或 dead code 作为交付替代。

## Service / Plugin / Provider 调用纪律

Service 层只允许做业务编排，不允许直接 import、实例化或调用具体 provider，包括：

- RAGFlow；
- FastGPT；
- OpenAI；
- embedding provider；
- 具体 vector DB provider；
- 本地模型 runtime。

具体 provider 只能存在于 provider / plugin / adapter / client 边界之后。允许的位置包括：

- plugin implementation class；
- adapter implementation class；
- client wrapper；
- provider-specific infrastructure module；
- test-only mock 或 test double。

Service 层应依赖 interface 或 application-level port。Provider selection 应通过配置、依赖注入、manager 或 factory 边界完成，不能写死在业务编排中。

## Phase Guard

Codex 必须将每次请求与 `docs/execution/phase-boundaries.md` 对照。

当 Issue 处于 `V1.5 / V2-prep` 时，Codex 可以准备 plugin boundary 和治理文档，但不得实现：

- V3 Agent Runtime；
- Planner / Executor；
- Tool Registry；
- Workflow Engine；
- V4 Plugin Registry 或 Marketplace；
- V4 Multi-Agent 平台行为；
- V4 tenant isolation。

## PR 描述要求

每个 PR 必须包含：

- 当前阶段；
- 修改范围；
- Boundary Check；
- 验证命令和结果；
- 是否改变 API / DB / schema / 配置；
- governance-only 任务必须明确标注 `governance-only change`。

建议 PR 段落：

```markdown
Current phase: V1.5 / V2-prep

Change scope:
- ...

Boundary Check:
- governance-only change
- no business code changes
- no schema changes
- no RAG / Agent / Workflow runtime implementation

Validation:
- ...

API / DB / config impact:
- API: no
- DB/schema: no
- config: no
```

## 失败处理

验证失败时，Codex 必须判断失败来自当前 PR 还是既有环境状态。相关验证通过前，或未以具体命令和错误说明 blocker 前，不得声称任务完成。
