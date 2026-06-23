# Executor Onboarding（Codex / Cursor / 后续 agent 通用）

> 当一个新 executor agent（Codex / Cursor / 其他）第一次接 PAS 仓库时，按本清单跑通环境。
>
> 出处：[ADR-002 § 1 三角分工](../PAS任务书-V1.0-20260622/decisions/ADR-002-collab-workflow.md)。
>
> Executor 可在任意机器（不必同台），通过 git remote + GitHub PR review 同步。

## 1. 必装基础

| 工具 | 最低版本 | 验证 |
|---|---|---|
| Node | 20 | `node --version` |
| pnpm | 11.5 | `pnpm --version` |
| Docker Desktop | 任意 24+ | `docker --version` |
| Git | 任意 2.40+ | `git --version` |
| GitHub CLI | 任意 2.40+ | `gh --version` |

Windows 用户：建议 PowerShell 7+ 或 Git Bash。

## 2. Clone + auth

```powershell
git clone git@github.com:Ruidooww/PAS.git
cd PAS
gh auth login                  # 用本机的 GitHub 账号；选 SSH
git config user.name "<你的名字>"
git config user.email "<你的邮箱>"
```

## 3. 依赖 + 共享包

```powershell
pnpm install
pnpm --filter @pas/shared build
```

## 4. 开发栈（postgres + redis + minio）

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps      # 三个 healthy
```

## 5. 环境变量

```powershell
# Windows PowerShell
Copy-Item .env.example .env
# Git Bash / WSL
# cp .env.example .env
```

编辑 `.env`：
- `*_CLIENT_MODE=mock` 是默认，不接真实 RAGFlow/LLM/CRM 即可跑通大部分 Issue
- `JWT_SECRET` 必填，至少 32 字符随机字符串
- 其他 `*_API_KEY` 在 mock 模式下随便填占位即可

真实凭据传递走加密渠道（1Password / 私聊），**不要进 git，不要贴对话**。

## 6. Prisma migration

```powershell
cd apps/api
pnpm prisma migrate dev
cd ../..
```

## 7. 验证环境（全绿才算装好）

```powershell
pnpm typecheck     # 全绿
pnpm lint          # 全绿
pnpm test          # 22 passed (按当前 main 上的测试数)
```

## 8. 关键 doc 速读

接 Issue 前**必读**：

| 文件 | 你需要知道什么 |
|---|---|
| [ADR-001 PAS+FastGPT+RAGFlow 三层栈](../PAS任务书-V1.0-20260622/decisions/ADR-001-pas-fastgpt-ragflow.md) | 架构 + E3 决策反转（FastGPT workflow MVP 不调用） |
| [ADR-002 协作流程](../PAS任务书-V1.0-20260622/decisions/ADR-002-collab-workflow.md) | 你的角色 / Issue SOP / PR 关联 |
| [issue-board](./issue-board.md) | 全部 Issue + 依赖图 + 派单波次 |
| [exp-001 RAGFlow MCP 实测](./experiments/exp-001-ragflow-mcp-fastgpt.md) | RAGFlow 真实契约（字段名 / 参数 / 已知 bug） |
| [apps/api/src/clients/README.md](../apps/api/src/clients/README.md) | clients 薄包装模式（D2 落地） |

## 9. 接 Issue 时的流程

按 [ADR-002 § 3 Issue 派单 SOP](../PAS任务书-V1.0-20260622/decisions/ADR-002-collab-workflow.md)：

1. 用户给你 Issue URL（`https://github.com/Ruidooww/PAS/issues/<N>`）+ prompt
2. **读完 Issue body + 所有链接的 ADR / spec 后再动手**——不要跳过
3. 起 feature 分支（`feat/<short-name>` 或 `chore/<short-name>`）
4. 实施。任何升级镜像 / 改端口 / 跨 Issue 范围的事，**先在 Issue 评论里说明**
5. 开 PR，body 顶部 `Closes #<N>`，按 [PR template](../.github/pull_request_template.md) 填
6. 阻塞或偏离 spec → Issue 评论报告，**不硬干**

## 10. 是否需要本机装 RAGFlow / FastGPT

| Issue 类型 | RAGFlow | FastGPT |
|---|---|---|
| **#6 IdP** | ❌ | ❌ |
| #8/#9/#12/#13/#15/#18/#21/#22/#23/#24 | ❌ mock 模式即可 | ❌ |
| #7 / #10 / #11 QA 系列 | ✅ 需要真实 | ❌ |
| #14 方案流水线 | ✅ | ❌（决策反转后不调） |
| #25 KbDocument 同步 / #27 W1 gate harness | ✅ | ❌ |

**起点建议**：从 mock-only Issue 开始（如 #6 / #13 / #23 / #24），跑通 1 个 PR 验证全流程稳定后再考虑装 RAGFlow。

装 RAGFlow 时参考 memory `pas-ragflow-local-env`（如有权访问）或问 orchestrator (Claude)。

## 11. 跨机器 executor 并发约定

多个 executor 在不同机器各跑各的 feat 分支**可以并发**。但实践上保持 **"一次一个 Issue 在跑"**：
- Orchestrator (Claude) review 带宽有限
- 避免两个 Issue 改同一文件触发 merge conflict
- 用户调度：明确告诉 orchestrator "现在 X 在干 Issue #N"，orchestrator 不主动派非当值 executor

## 12. 卡住了怎么办

按优先级：
1. 在 Issue 评论里 @ 仓库 owner 提问，把现象 + 已试方案写清
2. 不要在 main 上动手脚 / 不要 `git push --force` / 不要跳过 hooks
3. 如果环境装不上，先把上面命令的输出和报错贴 Issue 评论里
