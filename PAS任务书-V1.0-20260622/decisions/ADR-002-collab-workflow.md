# ADR-002 — PAS 协作流程（Issue 派单 + PR 关联）

> 状态：Accepted ｜ 日期：2026-06-22
> 关联：[PAS-会话交接-2026-06-22.md](../PAS-会话交接-2026-06-22.md) §6（原始约定）、[ADR-001](./ADR-001-pas-fastgpt-ragflow.md)

## 背景

会话交接文档 §6 已经定下"Claude orchestrator + Codex executor + GitHub Issue/PR 当协作底座"。但 E0 阶段实际操作时漂移了——brief 被写成 `tasks/pas/E0-CODEX-EXEC.md` 直接 commit 到 main，PR #1 没绑 Issue，整个仓库到目前 0 个 Issue。本 ADR 把约定**写死进 repo** 并明确两层 doc 模型，避免再漂。

## 决定

### 1. 三角分工

| 角色 | 谁 | 职责 |
|---|---|---|
| 决策人 / merge 按钮 | 仓库所有者（ruidooww） | 架构拍板、PR 终审、点 merge |
| **Orchestrator** | Claude | 架构 / 拆任务 / **写 Issue** / 审 PR / 本地集成测试 |
| **Executor** | Codex | 按 Issue 实施 → PR |

Cursor 不进 CI。Codex 和 Claude 同台本机，`gh` CLI 已 auth，可直接 `gh issue create` / `gh pr diff`。

### 2. 两层 doc 模型

| 层 | 落地 | 例子 | 改动流程 |
|---|---|---|---|
| **长期 spec / epic / 决策** | repo 内 markdown | `PAS-任务书-V1.0.md`、`tasks/pas/E0–E5*.md`、`decisions/ADR-*.md` | Claude 分支 → PR → 所有者 merge |
| **可执行任务派单** | **GitHub Issue** | "起 RAGFlow MCP + FastGPT 验证"、"加 agentClient 占位" | Claude `gh issue create` → Codex 实施 → Codex PR `Closes #N` |

**不再往 `tasks/pas/` 添加 `*-CODEX-EXEC.md`**。`tasks/pas/E0-CODEX-EXEC.md` 保留作为历史首例，**不是模板**。

### 3. Issue 派单 SOP

1. Orchestrator `gh issue create` 起 Issue：
   - **标题**：动词开头 + 范围 + 验收一句话
   - **Body**：
     - 背景（指向 ADR / spec md，给上下文）
     - 任务步骤（编号清单）
     - 验收标准（可勾选）
     - 输出物（PR 应包含哪些文件 / 命令产出 / 截图）
   - **Labels**（约定集合）：
     - `executor:codex`（必填，标识由 Codex 实施）
     - `epic:E0` … `epic:E5` 或 `epic:v2`（如适用）
     - `area:*` — 例如 `area:capability-supplier`、`area:infra`、`area:spec`、`area:devexp`
2. Codex 起 feature 分支（建议 `feat/<short-name>` 或 `chore/<short-name>`）
3. Codex 开 PR，PR body 顶部 `Closes #<n>` 自动关联
4. Orchestrator review + 本地集成测试（云端 Action 做不到 localhost 集成，这是不可替代环节）
5. 所有者 merge；Issue 自动关闭

### 4. 例外（不走 Issue）

- **ADR / spec 类文档**：由 Orchestrator 自产，**直接走分支 → PR**，不需要 Issue（因为不是派给 Codex 实施的，而是 Orchestrator 自己的产物）。这类 PR 不需要 `Closes`。例：本 ADR、ADR-001。

### 5. 自动化路线

按交接文档 §6 步骤 ④：**先手动跑通**几轮 Issue → Codex → PR → 审，验证稳定后再上 **self-hosted GitHub Actions runner**（云端 runner 连不到 localhost RAGFlow / Postgres / CRM，自动化必须 self-hosted）。

**约束**：自动触发 ≠ 自动合并。每个 PR 仍要人审。

## 后果

### 正向
- Codex 有"待领取队列"（Issue list），不再依赖我口头/聊天通知。
- 任务历史可追溯：Issue → PR → commit 三连，事后查"为什么这么做"能直接看到 brief 原文。
- 长期 spec 和派单任务**物理隔离**：spec 改动改 markdown，任务派单不污染 spec 历史。

### 反向 / 须监控
- Issue 是协作底座，Issue 写得糟 = Codex 实施糟。Orchestrator 写 Issue 时要按 SOP 把验收标准/输出物显式列出。
- Labels 体系需要纪律。建议初期由 Orchestrator 统一打标，不让 Codex 自创标签。

## 迁移

- **E0-CODEX-EXEC.md**：保留作为历史记录，**不删**。
- **下一个 brief**（RAGFlow MCP + FastGPT 接入最小验证）：作为新流程**首次试跑**，全程走 Issue。

## 后续工作

- [ ] 本 ADR merge 后立即用本流程发出第一个 Issue：RAGFlow MCP + FastGPT 接入最小验证
- [ ] 跑通 3 轮 Issue→PR 后再评估 self-hosted runner 自动化
- [ ] 视需要新增 `area:` label 词表（按出现频率扩展）
