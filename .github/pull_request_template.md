# PAS PR Checklist

<!-- 如果是关联 Codex 任务的 PR，请在下一行写 Closes #N（GitHub 会自动关联） -->
Closes #

## Phase

- [ ] V1
- [ ] V1.5 / V2-prep
- [ ] V2
- [ ] V3
- [ ] V4

## Summary

<!-- 1-3 句说清做了什么、为什么。governance-only 任务请明确写 governance-only change。 -->

## Scope

<!-- 列出主要修改文件 / 模块。trivial 改动不用列。 -->
-

## Boundary Check

- [ ] Read `docs/execution/current-phase.md`.
- [ ] Read `docs/execution/phase-boundaries.md`.
- [ ] Read `docs/execution/codex-rules.md`.
- [ ] Followed the current Issue scope and latest applicable Issue comment.
- [ ] No V1 rewrite.
- [ ] No completed business feature deletion.
- [ ] No unrelated file changes.
- [ ] No secrets, `.env`, or credentials committed.
- [ ] No application runtime code or business logic changes unless the current Issue explicitly requires them.
- [ ] No API contract, DB/schema, or config contract changes unless the current Issue explicitly requires them.
- [ ] No guard scripts added unless the current Issue explicitly requires them.
- [ ] No premature PluginManager implementation.
- [ ] No premature AgentRuntime implementation.
- [ ] No premature WorkflowEngine implementation.
- [ ] No premature Marketplace or multi-tenant platform implementation.
- [ ] Service layer does not directly hard-code RAGFlow, FastGPT, OpenAI, embedding providers, VectorDB providers, or other concrete AI/data providers.
- [ ] Provider boundary awareness includes both `apps/api/src/clients/*` and `packages/clients`.

## Tests

<!-- 勾选实际运行的命令；未运行的命令必须在 Notes 里说明原因。 -->
- [ ] `git diff --check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] Issue-specific smoke / manual verification
- [ ] Required CI checks passed

Notes:
-

## API / DB / Config Impact

- API: <!-- yes / no -->
- DB/schema: <!-- yes / no -->
- Config: <!-- yes / no -->

## 偏离 Issue / spec 的地方

<!-- 实施时如果做了 Issue 没要求的事，或没做 Issue 要求的事，**显式说明**。没有则写“无”。 -->
-

## Review 关注点

<!-- 想让 reviewer 重点看的地方（架构选择 / 安全 / 性能 / 数据迁移等）。没有则写“无”。 -->
-

## 后续 / 待办

<!-- 拆到下一个 Issue 的事项。没有则写“无”。 -->
-
