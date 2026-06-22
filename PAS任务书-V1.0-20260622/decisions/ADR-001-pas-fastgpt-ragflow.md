# ADR-001 — PAS + FastGPT + RAGFlow 三层能力栈

> 状态：Accepted ｜ 日期：2026-06-22
> 关联：任务书 V1.0 §4（能力供应商）、E2-售前问答、E3-方案生成、E5-内测上线

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

### 调用矩阵

| 场景 | 客户端 | 路径 | 选型理由 |
|---|---|---|---|
| **E2 单点问答** | `ragflowClient` | PAS → RAGFlow | gate 已验证的路径，不绕 FastGPT 省一跳延迟 |
| **E3 方案生成** | `agentClient` | PAS → FastGPT 工作流 → RAGFlow | FastGPT 工作流编排 7 章节流水线，省自研编排引擎 1.5–2 个月 |
| **v2 智能客服 Agent** | `agentClient` | PAS → FastGPT → 多工具 (含 RAGFlow MCP) | FastGPT 主战场 |
| **v2 客户演示** | FastGPT Iframe | 私有化部署分享窗 | License 兼容（私有化非 SaaS） |
| **E5 内测评测** | PAS 端 | 拉 FastGPT 应用日志/评测 API | 复用 FastGPT 评测体系 |

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

## 后果

### 正向
- 自研工作量降幅估算：Agent/工作流编排 1.5–2 月、可视化 Flow 1.5 月、调用链路日志 3 周、应用评测 3 周、Iframe 分享 1–2 周 = **合计 ≈4 月 → 复用后 ≈2 周适配**。
- D2 不破：所有外部能力仍走薄包装，可替换性保留。
- RAGFlow 是唯一非结构化事实源（PAS 和 FastGPT 都指向同一个 KB id）。

### 反向 / 须监控
1. **License 红线（FastGPT）**：FastGPT Open Source License **禁止提供 SaaS**；多租户云版必须谈商业授权；未授权商用需保留版权信息。**触发点**：PAS 走向云版前必须先决定是否买商业版。
2. **KB 双入口一致性**：禁止任何人在 FastGPT 自带 KB 里再导一份 IP-Guard 文档。**规则**：FastGPT 只允许通过 MCP/API KB 指向 RAGFlow，禁用本地 KB 上传。代码评审 + 部署模板里要把"FastGPT 本地 KB 入口"显式关掉或加 lint。
3. **身份注入**：FastGPT 不认飞书/企微。`agentClient` 必须在每次调用注入 `{ pas_user_id, tenant_id, customer_id }` 到 FastGPT 会话变量，工作流再透传给工具调用——否则日志/评测和 PAS 用户对不上。
4. **MCP 引用渲染**：MCP 返回 chunks 不会自动渲染引用 UI，需在 FastGPT 工作流末端做引用模板节点。

## 任务书映射（增量改动）

- **E0**：增加 FastGPT docker compose + `agentClient` 薄包装占位。
- **E1 权限**：不变。FastGPT 不对终端用户暴露，IdP 只在 PAS 一侧。
- **E2 售前问答**：不变。维持 PAS 自编排 retrieve+LLM 直连 RAGFlow（gate 已验证）。
- **E3 方案生成**：生成流水线（§3.3）由 FastGPT 工作流编排，每章节通过 MCP 调 RAGFlow 检索。详见 [E3-方案生成.md](../tasks/pas/E3-方案生成.md)。
- **E4 客户商机**：不变。
- **E5 内测**：评测体系复用 FastGPT 应用评测 + 对话标注，结果回流 PAS Postgres。
- **v2**：智能客服 Agent / Agent 编排 / Iframe 分享落到 FastGPT。

## 后续工作（不在本 ADR 范围）

- [ ] RAGFlow MCP server 启动 + `mcp-inspector` 联通验证（独立 task brief，给 Codex）。
- [ ] FastGPT docker compose 加入 E0 基建。
- [ ] `agentClient` 抽象设计 + 身份注入规范。
- [ ] 引用渲染模板节点 + "PAS 默认检索配置" MCP 套层方案选型。
- [ ] License 商业授权决策点：PAS 云版路线确定时复核。

## 附录 A：评估过但**未采用**的候选

### Zleap-AI/SAG（2025-11 建库，1.3k stars）
- 自创 chunk→event+entity 多跳检索，论文声称 HotpotQA/2WikiMultiHop/MuSiQue Recall@2 比 HippoRAG 2 高 +11pp。
- **不采用理由**：仅支持 .md/.txt，IP-Guard 语料多为 PDF/DOCX/PPTX，等于自建 DeepDoc 替代品；RAGFlow gate 已 GO，切换 = 重跑验证；7 个月新项目不适合做 v1 基底。
- **保留为 v2 候选**：若 v2 发现 RAGFlow 多跳召回是瓶颈，按 D2 接成第二个 `ragflowClient` 实现做 A/B。
