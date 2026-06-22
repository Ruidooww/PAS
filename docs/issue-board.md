# PAS Issue Board

> 自动化任务派单全景。
> 来源：任务清单 V1.0 全部 32 子任务 + 任务书 §7 工程纪律 + ADR-001 衍生验证任务。
> 维护节奏：每开/合一个 Issue，更新本页（短期手维护；后续可加 GH Actions 自动同步）。

## 状态约定

| Status | 含义 |
|---|---|
| 🟢 Open | 已开 Issue，待 Codex 实施 |
| 🟡 Running | Codex 正在实施 / PR 在 review |
| ✅ Done | 已 merge |
| ⏸ Blocked | 等前置 Issue |
| — | 不开 Issue（已在 PR #1 完成 / v2 范围外） |

## 全景表（按 Epic）

### E0 工程基建

| 子任务 | Issue | 状态 |
|---|---|---|
| E0.1 pnpm monorepo | — | ✅ PR #1 |
| E0.2 Prisma + Postgres | — | ✅ PR #1 |
| E0.3 dev compose | — | ✅ PR #1 |
| E0.4 config + zod | — | ✅ PR #1 |
| E0.5 clients mock 占位 | — | ✅ PR #1 |
| E0.5 clients 真实实现 | [#5](https://github.com/Ruidooww/PAS/issues/5) | 🟢/⏸ #4 |
| E0.6 CI lint/typecheck/test | — | ✅ PR #1 |
| (ADR-001 衍生) RAGFlow MCP + FastGPT 验证 | [#4](https://github.com/Ruidooww/PAS/issues/4) | 🟡 |

### E1 权限基座

| 子任务 | Issue | 状态 |
|---|---|---|
| E1.1+E1.2 IdP + JWT | [#6](https://github.com/Ruidooww/PAS/issues/6) | 🟢 |
| E1.3+E1.4+E1.5 路由隔离 + RBAC + ACL | [#8](https://github.com/Ruidooww/PAS/issues/8) | 🟢/⏸ #6 |
| E1.6+E1.7 脱敏 + 审计 | [#9](https://github.com/Ruidooww/PAS/issues/9) | 🟢/⏸ #8 |
| (E1.5 配套) RAGFlow KbDocument 同步 worker | [#25](https://github.com/Ruidooww/PAS/issues/25) | 🟢/⏸ #5,#8 |

### E2 售前问答

| 子任务 | Issue | 状态 |
|---|---|---|
| E2.1+E2.2+E2.3 RAGFlow 对接 + QA SSE + 引用 | [#7](https://github.com/Ruidooww/PAS/issues/7) | 🟢/⏸ #5 |
| E2.4+E2.6 ACL 过滤 + 反馈 | [#10](https://github.com/Ruidooww/PAS/issues/10) | 🟢/⏸ #7,#8 |
| E2.5 问答前端 | [#11](https://github.com/Ruidooww/PAS/issues/11) | 🟢/⏸ #7 |

### E3 方案生成

| 子任务 | Issue | 状态 |
|---|---|---|
| E3.1 需求结构化 | [#12](https://github.com/Ruidooww/PAS/issues/12) | 🟢/⏸ #6 |
| E3.2 方案模板体系 | [#13](https://github.com/Ruidooww/PAS/issues/13) | 🟢 |
| E3.3 生成流水线 (FastGPT+MCP) | [#14](https://github.com/Ruidooww/PAS/issues/14) | 🟢/⏸ #4,#5,#12,#13 |
| E3.4 CRUD + 版本 | [#15](https://github.com/Ruidooww/PAS/issues/15) | 🟢/⏸ #12 |
| E3.5 导出 Word/MD | [#16](https://github.com/Ruidooww/PAS/issues/16) | 🟢/⏸ #15 |
| E3.6 方案前端 | [#17](https://github.com/Ruidooww/PAS/issues/17) | 🟢/⏸ #12,#14,#15,#16 |

### E4 客户/商机

| 子任务 | Issue | 状态 |
|---|---|---|
| E4.1+E4.2+E4.3 crmClient + 读取 + 关联 | [#18](https://github.com/Ruidooww/PAS/issues/18) | 🟢/⏸ #6,#12 |
| E4.4 前端 | [#19](https://github.com/Ruidooww/PAS/issues/19) | 🟢/⏸ #17,#18 |

### E5 内测上线

| 子任务 | Issue | 状态 |
|---|---|---|
| E5.1 E2E smoke | [#20](https://github.com/Ruidooww/PAS/issues/20) | 🟢/⏸ 全部 backend+frontend |
| E5.2 生产部署 | [#21](https://github.com/Ruidooww/PAS/issues/21) | 🟢/⏸ #20 |
| E5.3 反馈看板 | [#22](https://github.com/Ruidooww/PAS/issues/22) | 🟢/⏸ #10 |

### 工程纪律 (任务书 §7)

| 子任务 | Issue | 状态 |
|---|---|---|
| §7-E3 Prompts 集中 + lint 禁内联 | [#23](https://github.com/Ruidooww/PAS/issues/23) | 🟢 |
| §7-E4 关键参数集中配置 | [#24](https://github.com/Ruidooww/PAS/issues/24) | 🟢 |

### v2 / 范围外

任务清单"范围外（v2）"已明确，**不开 Issue**：智能客服 Agent / 多渠道 / 会议 / 合同财务 / Agent 编排 / 驾驶舱 / CIP 客情系统等。

## 依赖图（精简）

```
PR #1 (E0 scaffold) ────────────────────────────────────────────────┐
                                                                     │
ADR-001 / ADR-002 (PR #2/#3) ───────────────────────────────────────┤
                                                                     │
#4 MCP验证 ──→ #5 clients ──→ #7 QA backend ──┬──→ #10 ACL+反馈     │
                  │                              │                   │
                  │                              └──→ #11 QA 前端    │
                  │                                                  │
                  └─→ #14 方案流水线 ←─ #4 ──────────────────────────┤
                                                                     │
#6 IdP ──→ #8 ACL ──→ #9 脱敏审计                                   │
            ├─→ #25 KbDocument 同步 ←── #5                          │
            ├─→ #18 CRM backend                                      │
            └─→ #12 需求结构化 ──┬─→ #14 ─┬─→ #15 ─→ #16 ─→ #17 ─┐ │
                                  └─→ #15 ─┘                       │ │
                                  └─→ #18 ──→ #19 ←── #17         │ │
                                                                   │ │
#13 模板 (独立) ──→ #14                                            │ │
                                                                   ▼ ▼
                                                              #20 E2E ──→ #21 生产
                                                              #22 反馈看板 ←── #10
```

## 派单波次（Codex 顺序）

每波尽量并行；下波等上波 merge。

| Wave | 派单 | 解锁 |
|---|---|---|
| **0 (now)** | #4 | MCP/FastGPT 路径决策 |
| **1** | #5, #6 | clients + auth 双线 |
| **2** | #7, #8, #13, #23, #24 | E2 后端 / E1 ACL / E3 模板 / 工程纪律 |
| **3** | #9, #11, #12, #18 | E1 收尾 / QA 前端 / 需求结构化 / CRM 后端 |
| **4** | #10, #14, #15, #25 | ACL 过滤 + 反馈 / 方案流水线 / CRUD / KB 同步 |
| **5** | #16 | 导出 |
| **6** | #17, #22 | 方案前端 / 反馈看板 |
| **7** | #19 | CRM 前端 |
| **8** | #20 | E2E smoke |
| **9** | #21 | 生产部署 |

## 派单 prompt 模板

```text
请处理 GitHub Issue：https://github.com/Ruidooww/PAS/issues/<N>

要求：
1. 读完 Issue body + 链接的所有 ADR/spec 后再动手
2. 按"任务步骤"顺序执行，不做"不在本 Issue 范围"的事
3. 任何升级镜像/改端口/跨 Issue 范围的事，先在 Issue 评论里说明
4. 起 feature 分支（命名见 Issue 建议）
5. PR body 顶部 `Closes #<N>`
6. 阻塞或偏离 spec → Issue 评论报告，不硬干

仓库：git@github.com:Ruidooww/PAS.git
本机路径：C:\Users\Ruidoww\Documents\HYYA\AI\PAS
依赖（RAGFlow / Docker / gh CLI）都在本机可用
```

## Label 词表

| Label | 用途 |
|---|---|
| `executor:codex` | 由 Codex 实施（必填） |
| `epic:E0`..`epic:E5` | 任务清单 epic |
| `area:auth` | IdP / 鉴权 / 会话 |
| `area:qa` | 售前问答 / RAG 端到端 |
| `area:proposal` | 方案生成相关 |
| `area:crm` | 客户/商机相关 |
| `area:capability-supplier` | RAGFlow / FastGPT / LLM |
| `area:frontend` | Next.js 前端 |
| `area:audit` | 脱敏 / 审计 / 安全 |
| `area:export` | 文档导出 |
| `area:ops` | CI / 部署 / 运维 |
| `area:devexp` | 工程规范 / 开发体验 |
| `blocked` | 等前置 |

## 维护说明

- 每开 Issue 在对应表格补一行；merge 后改状态为 ✅
- 依赖关系变更（如新 Issue 阻塞其他）→ 更新依赖图段落
- 工程纪律（任务书 §7）或 ADR 派生的新工装 Issue 进"工程纪律"段落
- 阶段二 / v2 项目启动时，单独建 `docs/issue-board-v2.md`
