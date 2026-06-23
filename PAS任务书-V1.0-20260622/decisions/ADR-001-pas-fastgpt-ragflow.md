# ADR-001 — PAS + FastGPT + RAGFlow 三层能力栈

> 状态：Accepted (Amended 2026-06-23) ｜ 原日期：2026-06-22
> 关联：任务书 V1.0 §4（能力供应商）、E2-售前问答、E3-方案生成、E5-内测上线、`docs/experiments/exp-001-ragflow-mcp-fastgpt.md`
>
> **修订记录**（详见末尾 § 决策修订记录）：
> - 2026-06-23：**E3 调用路径反转**。原计划"E3 → FastGPT workflow → RAGFlow"经 exp-001 实证后改为"E3 → PAS BullMQ 自编排 → RAGFlow 直连"。FastGPT MVP 缩到仅留 v2 用面。

## 背景

PAS 任务书 V1.0 已定 D2 原则：**所有外部能力以薄客户端包装接入，对等可替换**。RAGFlow gate 已 Conditional GO（baseline + rerank=gte-rerank-v2 + page_size=30）。本 ADR 锁定 v1/v2 外部能力供应商组合，避免反复评估。

评估过的候选见附录 A。

## 决定

PAS 的能力栈采用 **三层共存**：

```
┌────────────────────────────────────────────────────┐
│  PAS  (NestJS + Next.js + Postgres)                │
│  业务主体 / IdP / 客户商机 / 方案 / 前端 / 报表        │
└──────────┬─────────────────────────────────────────┘
           │ 薄包装客户端 (D2)
   ┌───────┴───────┬──────────────┐
   ▼               ▼              ▼
ragflowClient   agentClient    crmClient
   │               │              │
   ▼               ▼              ▼
RAGFlow         FastGPT       (3rd CRM)
检索基底         Agent/编排
(内网)           (内网)
                   │
                   └─ MCP → RAGFlow MCP server
```

### 分工

| 层 | 谁 | 负责 |
|---|---|---|
| 业务主体 | **PAS** | 飞书/企微 IdP、客户/商机/方案/合同、权限、前端、报表、所有结构化数据 |
| Agent / 工作流编排 | **FastGPT** (内部部署，不对终端用户暴露) | 多步推理、工具调用、可视化 Flow、对话日志、应用评测、Iframe 分享 |
| 非结构化检索 | **RAGFlow** | IP-Guard 199 文档、DeepDoc 解析、混合检索 + gte-rerank-v2 |
| LLM | 百炼 qwen 系列 | 三家共用 |

### 调用矩阵（修订后，2026-06-23）

| 场景 | 客户端 | 路径 | 选型理由 |
|---|---|---|---|
| **E2 单点问答** | `ragflowClient` | PAS → RAGFlow | gate 已验证，不绕 FastGPT |
| **E3 方案生成** | `ragflowClient` + `llmClient` | **PAS BullMQ 自编排，章节 for-loop 直连 RAGFlow + LLM** | exp-001 实证 FastGPT workflow preview dispatch 阻塞；改 PAS 自编排，章节循环本质就是 for+retry，无需可视化编排器；与 E2 同模式统一架构 |
| **v2 智能客服 Agent** | `agentClient` | PAS → FastGPT → 多工具 (含 RAGFlow MCP) | 留座；v2 启动时先重测 FastGPT workflow blocker 是否解 |
| **v2 客户演示** | FastGPT Iframe | 私有化部署分享窗 | License 兼容（私有化非 SaaS）；不依赖 workflow，独立可用 |
| **E5 内测评测** | PAS 端 | **暂走 PAS 自有对话日志聚合** | FastGPT 评测复用搁置（依赖未通的 workflow 链路） |

**原计划**（2026-06-22 ADR 初版）E3 走 `agentClient` → FastGPT workflow → RAGFlow。**反转原因**见末尾 § 决策修订记录。

### RAGFlow → FastGPT 集成：MCP 优先

RAGFlow 0.17+ 内置 MCP server（暴露 `list_datasets`、`retrieval` 等工具）。FastGPT 明确支持"双向 MCP"。

**选 MCP 不选 API 知识库的理由**：
1. 标准协议，跨平台。同一个 RAGFlow MCP 可被 FastGPT / PAS / Cursor / Claude Desktop 同时复用。
2. 不写 FastGPT 私有协议 adapter，RAGFlow 官方维护。
3. D2 友好——MCP 本身就是薄包装的标准化版本。

**代价 + 补救**：
- MCP 语义是"工具调用"而非"KB 检索"——FastGPT 的引用 UI / rerank 配置面板用不上。
- 补救 1：工作流加一个模板节点，把 MCP 返回的 chunks 渲染成 `[n]` 注脚塞 LLM 上下文。
- 补救 2：在工具入参里硬编码 gate 验证过的 `rerank=gte-rerank-v2 + page_size=30`；或再套一层"PAS 默认检索配置 MCP"预置死参数，FastGPT 只传 query。

E3 是否走 MCP 还是 API KB（声明式、引用 UI 原生），等 MCP 最小验证跑通后再决定；**v2 Agent 一定走 MCP**。

### FastGPT 在 MVP 用面 vs v2 用面（澄清）

**接入 FastGPT ≠ 用上 FastGPT 全部能力**。MVP 只用其中一小部分；其余能力作为基础设施"埋桩"，v2 兑现红利。

| FastGPT 能力 | MVP（修订 2026-06-23）| v2 | 备注 |
|---|---|---|---|
| 工作流编排（Flow） | ❌ exp-001 实证不可用 | ⚠ 留座 | v2 启动时先重测 dispatch blocker 是否解 |
| MCP 双向接入 | ❌ E3 改 PAS 直连 | ⚠ 留座 | RAGFlow MCP 本身 OK，FastGPT 那侧不通 |
| OpenAPI（completions） | ❌ MVP 不调 | ⚠ 留座 | `agentClient` 保留为 stub，真实调用 v2 |
| 应用日志 / 调用链路 trace | ❌ 暂搁置 | ⚠ 留座 | 依赖 workflow 链路；MVP 用 PAS 自有日志 |
| 应用评测体系 | ❌ 暂搁置 | ⚠ 留座 | 同上 |
| 智能客服 Agent（对外 7×24） | — | ✅ | 瓶颈：多渠道接入 + 外部路由 + 公开 KB（+ workflow 重测） |
| 可视化 Flow 编辑器（开放给业务用户）| — | ✅ | 瓶颈：sandbox + 权限 + 资源配额 |
| Iframe 分享窗 / 免登录分享 | — | ✅ | 售前给客户演示方案；**独立于 workflow，可单独用** |
| MCP server 暴露（PAS 当 server） | — | ✅ | 让外部 agent 接入 PAS 能力 |
| 多模型可视化配置 | ❌ | ❌ | 走 PAS 自有 config |
| 语音输入输出 | ❌ | ❌ | 多渠道 v2 才考虑 |
| 模板市场 | ❌ | ❌ | 自写 prompt |

**关键认知（修订）**：原计划"FastGPT MVP 用 5 项 / 省 ≈4 月"基于"FastGPT workflow 可用"假设；实证后该假设不成立，**MVP 实际用面是 0 项**。FastGPT 容器仍在跑（infra/docker-compose.fastgpt.yml 已合），但 PAS MVP 代码不调用它——保留为 v2 候选。Iframe 分享窗是唯一与 workflow 解耦的能力，v2 启用时直接可用。

## 后果

### 正向（修订）
- D2 不破：所有外部能力仍走薄包装，可替换性保留。
- RAGFlow 是唯一非结构化事实源。
- E3 与 E2 同模式（PAS 直连 RAGFlow），统一架构、统一审计、统一测试基建。
- 章节循环本质 `for + retry`，PAS BullMQ 实现 ≈1 周，**比"FastGPT workflow + 验证 dispatch + 模板节点 + identity 透传 + version 状态调试"反而更快更稳**。

### 正向（已撤销 / 不再成立）
- ~~"省 ≈4 月编排引擎自研"——基于 FastGPT workflow 可用假设，exp-001 证伪~~
- ~~"调用链路日志 / 应用评测复用"——依赖 workflow 链路~~

### 反向 / 须监控（修订）
1. **License 红线（FastGPT）**：仍有效。MVP 不调用 FastGPT 不影响——v2 启用前仍须决策商业授权。
2. **KB 双入口一致性**：仍有效。FastGPT 容器在跑，禁止任何人在 FastGPT 自带 KB 里导 IP-Guard 文档——即便 MVP 不调用，v2 启动时也要从干净状态启 workflow。
3. ~~身份注入~~ ~~MCP 引用渲染~~：MVP 路径不涉及，v2 启用时再处理（届时 ADR 再评估是否仍按这套契约）。
4. **新增：FastGPT workflow dispatch blocker**：exp-001 实测 `chatTest` 不进入节点执行（chat_item_responses/llm_request_records/MCP 调用全空）。FastGPT v4.14.25 → UI 显示 V4.14.20，可能是版本不匹配或 app_versions 状态机问题。v2 重启前先查 FastGPT 上游是否有 fix。
5. **新增：RAGFlow MCP server page_size 上游 bug**：`_DATASET_PAGE_SIZE=1000` 与 API 限制 `<=100` 冲突；exp-001 用 runtime patch 解但**未持久化**——重启容器丢补丁。建议给 RAGFlow 上游开 issue + 在我们镜像或 entrypoint 持久化 patch。

## 任务书映射（修订后，2026-06-23）

- **E0**：FastGPT docker compose 已合（infra/docker-compose.fastgpt.yml）作为基础设施留座；`agentClient` 薄包装保留为 stub（接口 + mock + skip 集成测试），MVP 不实际调用。
- **E1 权限**：不变。FastGPT 不对终端用户暴露。
- **E2 售前问答**：不变。PAS 自编排 retrieve+LLM 直连 RAGFlow。
- **E3 方案生成**：**生成流水线（§3.3）改为 PAS BullMQ 自编排，章节 for-loop 内调 `ragflowClient.retrieve` + `llmClient.complete`**，不走 FastGPT workflow。详见 [E3-方案生成.md](../tasks/pas/E3-方案生成.md)。
- **E4 客户商机**：不变。
- **E5 内测**：评测暂走 PAS 自有对话日志聚合，**不复用 FastGPT 评测体系**（依赖未通的 workflow 链路）。
- **v2**：智能客服 Agent / Iframe 分享落到 FastGPT；启动前重测 workflow blocker 是否解。

## 后续工作（不在本 ADR 范围）

- [ ] RAGFlow MCP server 启动 + `mcp-inspector` 联通验证（独立 task brief，给 Codex）。
- [ ] FastGPT docker compose 加入 E0 基建。
- [ ] `agentClient` 抽象设计 + 身份注入规范。
- [ ] 引用渲染模板节点 + "PAS 默认检索配置" MCP 套层方案选型。
- [ ] License 商业授权决策点：PAS 云版路线确定时复核。

## 决策修订记录

### 2026-06-23：E3 调用路径反转 — FastGPT workflow → PAS 自编排

**触发**：Issue #4（exp-001）实测。

**实证发现**：
1. RAGFlow MCP 链路本身 OK（mcp-inspector 验通；3 gate query 检索基线 chunks 完整捕获）。
2. **FastGPT workflow preview dispatch 阻塞**：`chatTest` 启动 → 创建 Human/AI chat items → 但 chat_item_responses 空、llm_request_records 空、RAGFlow MCP `/mcp` 无新调用，停在"加载中..."至长超时。Mongo logs 显示失败在 dispatch 进入节点前，不是检索或 LLM 慢。
3. RAGFlow v0.26.1 MCP 实际契约和原假设不符：单一工具 `ragflow_retrieval`（不是 `list_datasets`+`retrieval`），`rerank_id` 需完整模型 ID `gte-rerank-v2@bailian@Tongyi-Qianwen`。
4. RAGFlow MCP server 上游 bug：`_DATASET_PAGE_SIZE=1000` 与 API 限制 `<=100` 冲突。
5. FastGPT app/current/version 三份状态 + workflow graph schema + UI preview body 状态机复杂——对 E3 章节循环没有必要收益。

**决策**：E3 改为 PAS BullMQ 自编排，直连 RAGFlow REST API。FastGPT 容器留座但 MVP 不调用，v2 智能客服启动时重测。

**理由**：
- D2 维度更干净（FastGPT 不该变成第二后端）
- 章节循环本质 `for + retry`，PAS 自实现 ≈1 周，比调试 FastGPT workflow + dispatch + version 状态机更快
- 与 E2 同模式，统一架构、统一测试基建、统一引用审计
- 不阻塞，立刻可推进

**v2 重启条件**（满足后 FastGPT workflow 才能进入 PAS 路径）：
1. RAGFlow MCP 修 `page_size` 默认值 + 持久化（不靠 runtime patch）
2. FastGPT workflow preview 稳定从当前 graph/version 进入节点执行
3. FastGPT 能稳定透传 `rerank_id` / `page_size` / `dataset_ids` 并暴露可审计 raw chunks
4. 3 gate query 能在 FastGPT workflow 内产出带引用答案（而不是只在 tool debug 层返回 chunks）

**留档**：完整决策报告 `docs/experiments/exp-001-ragflow-mcp-fastgpt.md`，含截图、retrieval-results.json、fastgpt-workflow-probes.json。

## 附录 A：评估过但**未采用**的候选

### Zleap-AI/SAG（2025-11 建库，1.3k stars）
- 自创 chunk→event+entity 多跳检索，论文声称 HotpotQA/2WikiMultiHop/MuSiQue Recall@2 比 HippoRAG 2 高 +11pp。
- **不采用理由**：仅支持 .md/.txt，IP-Guard 语料多为 PDF/DOCX/PPTX，等于自建 DeepDoc 替代品；RAGFlow gate 已 GO，切换 = 重跑验证；7 个月新项目不适合做 v1 基底。
- **保留为 v2 候选**：若 v2 发现 RAGFlow 多跳召回是瓶颈，按 D2 接成第二个 `ragflowClient` 实现做 A/B。
