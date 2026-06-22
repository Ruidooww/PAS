# PAS 售前辅助系统 — 任务书 V1.0

> 日期：2026-06-22
> 定位：全新项目（白纸起步，不沿用既往自研 RAG 成果）
> 知识库底座：RAGFlow（本地部署，REST API 接入）
> 后端语言：Node.js / TypeScript（主体）+ Python（仅边缘 AI 微服务，按需）

---

## 1. 项目定位与目标

### 1.1 一句话定位

PAS 是一个**售前赋能业务系统**，把"找客户 → 出方案 → 签合同 → 做售后"这条售前主链路用 AI 加速。它**不是**一个 RAG 系统——RAG 只是它背后众多能力之一。

### 1.2 核心价值（按优先级）

1. **方案生成**：客户需求 → 自动产出 IP-Guard 方案 + PPT（这是 PAS 区别于"通用问答工具"的核心差异）
2. **售前问答**：基于产品知识库回答配置/故障/竞品问题，带出处
3. **商机/客情**：自动整理商机、构建客户画像、辅助销售决策

### 1.3 关键设计原则（白纸重立，非沿用旧铁律）

| # | 原则 | 含义 |
|---|------|------|
| **D1** | 结构化归数据库，非结构化归 RAGFlow | 客户/商机/方案/合同进 Postgres；文档/知识进 RAGFlow。绝不混 |
| **D2** | 所有外部能力走薄客户端封装 | RAGFlow/LLM/CRM 各一个 client 文件，换供应商只改一处 |
| **D3** | 权限在代码边界，不在 prompt | 内部/外部用户用不同的工具集与路由树，不靠 prompt 约束 |
| **D4** | 敏感字段在 API 层脱敏 | 手机号/金额等按用户身份掩码，不靠前端隐藏 |
| **D5** | 重 AI 异步化 | 方案生成/客情采集走队列，不阻塞请求 |
| **D6** | polyglot at the edges | 主体全 TS；某功能真需要 Python 库才拆独立微服务 |

---

## 2. 总体架构

### 2.1 分层

```
┌──────────────────────────────────────────────────┐
│  接入层 Channels                                    │
│  Web │ 飞书 │ 企业微信 │ 公众号 │ 开放API             │
├──────────────────────────────────────────────────┤
│  网关 / BFF  ── 鉴权 · 限流 · 内外分流 · 脱敏          │
├──────────────────────────────────────────────────┤
│  PAS 业务核心（自研）                                │
│  方案生成 · 商机 · 客情 · 会议 · 合同 · 售后 · 权限     │
├──────────────────────────────────────────────────┤
│  能力供应层（外部依赖，可替换）                        │
│  RAGFlow │ LLM API │ 本地模型服务 │ CRM │ ASR │ OCR  │
├──────────────────────────────────────────────────┤
│  PAS 自有数据                                        │
│  Postgres（业务）│ 对象存储（文件）│ Redis（缓存/队列）  │
└──────────────────────────────────────────────────┘
```

### 2.2 数据流（以"方案生成"为例）

```
售前填客户需求
  → PAS 业务核心：需求结构化（调 LLM）
  → 入队列（BullMQ），返回任务ID
  → Worker：调 RAGFlow.retrieve 拉相关知识块
        + 调 LLM 按模板组装方案
        + 调 PPT 生成
  → 写 Postgres（方案记录）+ 对象存储（PPT 文件）
  → SSE/WebSocket 推进度给前端
  → 售前预览 / 人工修订 / 定稿
```

### 2.3 关键边界

- 业务核心**永不直接** import RAGFlow/LLM SDK，只调对应 client
- 业务数据（谁是客户、方案进度、合同金额）**永不进** RAGFlow
- RAGFlow 只存文档及其向量/图谱

---

## 3. 技术栈

| 层 | 选型 | 理由 |
|---|------|------|
| 前端 | **Next.js 15 (React + TS)** | 方案预览/对比/客户画像都要好界面；与后端共享类型 |
| 后端 | **NestJS (TS)** | 模块化 + 依赖注入 + 内置管道/守卫，天然契合"内外分流+脱敏" |
| ORM | **Prisma** | 端到端类型安全，schema 即文档 |
| 业务库 | **PostgreSQL 16** | 客户/商机/方案/合同关系型最稳 |
| 队列 | **Redis + BullMQ** | 方案生成/客情采集异步化（D5） |
| 文件 | **对象存储**（MinIO 本地 / 阿里云 OSS 生产） | 方案 PPT、合同 PDF、上传素材 |
| 鉴权 | **飞书/企业微信 OAuth + JWT** | 内部员工用 IdP；外部渠道独立 token |
| 知识库 | **RAGFlow**（REST API） | 文档解析 + 检索 + 知识图谱 |
| LLM | 云端 API（统一 client 封装） | 方案生成/需求结构化的直接 LLM 调用 |
| 边缘 AI | **Python 微服务**（按需） | 仅 PPT 精细生成 / 本地模型 / 复杂抽取才引入 |

**部署形态**：全 docker-compose。开发期单机；生产期 PAS 主服务 + Worker + Postgres + Redis + RAGFlow 全栈。

**起步可简化**：单人 MVP 阶段可先用 Next.js 全栈（API routes 当后端），业务复杂后再拆出独立 NestJS 后端。

---

## 4. 能力边界（谁负责什么）

明确划清，避免"什么都往 RAG 塞"或"什么都自己造"。

| 能力 | 由谁提供 | PAS 怎么用 |
|------|---------|-----------|
| 文档解析（PDF→结构化） | RAGFlow DeepDoc | 上传文档到 RAGFlow 知识库即可，PAS 不碰解析 |
| 向量化 / 检索 / rerank | RAGFlow | `ragflowClient.retrieve()` |
| 知识图谱（产品/客户关系） | RAGFlow GraphRAG | `ragflowClient.graphQuery()` |
| 带出处的多轮问答 | RAGFlow chat | `ragflowClient.chat()` 或自己编排 retrieve+LLM |
| 通用文本生成（方案/摘要/结构化） | LLM API | `llmClient.complete()` |
| 客户/商机/合同数据 | **阶段一第三方 CRM**（API 只读）/ 阶段二自研 | `crmClient` 适配器，换源不动业务（D2）|
| 方案模板/规则/组装 | **PAS 自研** | M14 方案引擎核心逻辑 |
| 权限/脱敏/审计 | **PAS 自研** | NestJS 守卫 + 拦截器 |
| 语音转写（会议/商机） | ASR API 或独立服务 | `asrClient.transcribe()` |
| PPT 生成 | pptxgenjs(起步) / Python 服务(精细) | `pptClient.generate()` |

### 4.1 RAGFlow client 接口契约（薄封装，待实测后定稿）

```typescript
interface RagflowClient {
  retrieve(p: { query: string; kbId: string; topK?: number;
                filters?: Record<string, unknown> }): Promise<Chunk[]>
  chat(p: { messages: Message[]; kbId: string }): AsyncIterable<string>
  graphQuery(p: { entity: string; kbId: string; hops?: number }): Promise<GraphResult>
  // 知识库管理（文档增删、状态查询）
  listDocs(kbId: string): Promise<Doc[]>
  uploadDoc(kbId: string, file: Buffer, meta: DocMeta): Promise<string>
}
```

> ⚠ 这一节的具体字段（chunk metadata、filters 支持度、graph 返回结构）**必须等 RAGFlow 3-query 实测后**根据真实 API 响应定稿，现在是占位草案。

---

## 5. 核心数据模型（PAS 自有，Postgres）

只列 MVP 必需的核心表，字段从简，详细字段在各模块 spec 展开。

```
User           用户（内部员工 / 外部访客）
 ├ id, name, email, role, is_external, dept_id, created_at

CustomerMirror 客户镜像（主数据在第三方 CRM；PAS 只缓存引用，阶段二可迁本地）
 ├ ref(第三方客户id,主键), source(external|pas), name, industry, scale, owner_id, synced_at
 └ 注：阶段一不在 PAS 增删客户，数据读自第三方 CRM（见 E4）

Opportunity    商机（阶段一读自第三方 CRM，PAS 不持有/不增删，仅按需缓存）
 └ 注：不建 PAS 本地商机表，经 crmClient 读；字段映射进 PAS 领域类型

Proposal       方案（PAS 原生，挂客户用 customer_ref）
 ├ id, customer_ref(指向 CustomerMirror.ref), opportunity_ref?, title, status(草稿/定稿)
 ├ requirement_json(结构化需求), content_json(方案内容)
 ├ ppt_file_key(对象存储), created_by, version, created_at

Contract       合同（阶段一在第三方 CRM；PAS MVP 不建表，v2 再定）

KbDocument     知识文档（PAS 侧的元数据，正文在 RAGFlow）
 ├ id, ragflow_doc_id, ragflow_kb_id, title, product, acl_scope, uploaded_by

AuditLog       审计日志（D3/D4 要求）
 ├ id, user_id, action, resource, is_external, detail_json, created_at

ConversationFeedback  问答反馈
 ├ id, user_id, query, answer, rating(👍/👎), session_id, created_at
```

**关键关联**：
- `Proposal.customer_ref` 指向 `CustomerMirror.ref`（即第三方客户 id）——阶段一客户主数据在第三方 CRM，PAS 经 `crmClient` 只读；阶段二自研后把 `source` 改 `pas`、ref 迁本地 id，关联不断（见 E4）
- `Proposal.requirement_json` 存结构化需求，生成时喂给 LLM
- `KbDocument.ragflow_doc_id` 是 PAS 与 RAGFlow 的**唯一关联键**——PAS 管元数据/权限，RAGFlow 管正文/向量
- `KbDocument.acl_scope` 决定哪些角色能检索该文档（D3 内容级权限的落点）

---

## 6. MVP 范围与里程碑

### 6.1 不做什么（明确砍掉，但保留架构座位）

> **全部能力（含路线图 .md 没单列的）已登记在** [PAS-能力全景-完整源对照.md](PAS-能力全景-完整源对照.md)，标了 MVP/v2/预留，杜绝子集遗漏。

路线图 15 个模块 + 智能客服 Agent + 角色控制台 / 方案审查 / 蒸馏微调 / 本地多模态 等 **不全做**。白纸起步先打通**一条端到端价值线**，验证"PAS+RAGFlow"模式成立，再扩。

**MVP 砍掉（后置 v2）**：M3 会议、M4 合同财务、M8 多渠道、M10 Agent编排、M11 驾驶舱、M12 渠道、M15 客情、**智能客服 Agent**。

> ⚠ **智能客服 Agent**（源文档《商业标准化与工程化闭环设计 V3.0》§7，标注"预留"）：
> 对外面向客户的智能客服——FAQ 机器人 / 业务咨询 / 工单 / 情感分析 / 转人工，三种模式（纯 AI / AI+人工 / 纯人工），**强隔离要求**（独立客服知识库、客服数据与 PAS 数据完全隔离、多租户、权限最小化）。
> 它是**对外隔离架构（D3 + E1 public 路由 + 外部能力集隔离）最主要的使用者**——MVP 不实现，但 §2 架构与 E1 权限基座必须为它**预留座位**：public 路由树、独立知识库、外部 token 机制现在就要设计对，v2 接客服时不返工。详见 §6.5。

### 6.2 MVP 做什么（2 条价值线）

| 优先级 | 模块 | 端到端价值 |
|--------|------|-----------|
| **P0** | 售前问答 | 员工登录 → 问 IP-Guard 问题 → RAGFlow 检索 → 带出处答案 |
| **P0** | 方案生成（精简版） | 填客户需求 → 检索知识 → LLM 生成方案初稿 → 导出（先 Markdown/Word，PPT 后置） |
| **P1** | 客户/商机接入 | 经 `crmClient` 读第三方 CRM（只读为主），给方案生成提供客户上下文 |
| **P1** | 权限基座 | 登录 + 内外分流 + 文档级 ACL（D3 最小实现） |

### 6.3 里程碑

| 阶段 | 目标 | 验收 |
|------|------|------|
| **M0 环境** | RAGFlow 跑通 + 3-query 实测过关 + NestJS/Next 骨架起 | 检索质量达标，否则回退选型 |
| **M1 问答闭环** | 售前问答端到端 | 员工浏览器问问题出带出处答案 |
| **M2 方案生成** | 方案生成精简版 | 填需求出方案初稿（Markdown） |
| **M3 业务数据** | 客户/商机接入（读第三方 CRM）+ 权限基座 | 方案能挂第三方客户；内外用户权限隔离 |
| **M4 内测** | 5 人试用 + 收集反馈 | 真实 query 拒答率/满意度达标 |

> 工期不在本任务书锁定（依赖语言最终定稿 + 人力）；先锁顺序与验收。

### 6.4 关键前置 gate

**M0 的 RAGFlow 3-query 实测是整个项目的 go/no-go 闸门**：
- 控制台加密策略（多轮"延申一下"）
- WPS 授权软件（默认软件库区分）
- UI 操作流程类窄答

实测不过 → 重新评估底座（回 Dify 或其他），架构其余部分不受影响（D2 保证）。

### 6.5 智能客服 Agent — v2，但 MVP 要预留座位

源文档标注"预留"，MVP 不实现。但因为它对外、强隔离，**现在的架构与 E1 权限基座必须为它留好位置**，否则 v2 接入要返工。

**MVP 阶段必须预留（设计对，不实现功能）**：
- `/api/public/*` 路由树独立存在（E1.3 已含），客服 v2 挂这里，不混入 internal
- 外部 token 机制 + `is_external=true`（E1.1 已含）
- 外部能力集隔离（E6）：客服 v2 只能拿到"公开知识库 client"，拿不到 crm / 内部检索

**v2 才做（明确不在 MVP）**：
- 独立客服知识库（与 PAS 知识库物理隔离，多租户）
- 客服会话/工单/排队/转人工
- 三模式（纯 AI / AI+人工 / 纯人工）+ 情感分析
- 客服-客户关系表、客服独立数据库

> 一句话：MVP 把"对外的门"设计对（D3 四层隔离），门后的客服系统 v2 再建。

---

## 7. 工程纪律

| # | 纪律 | 落地 |
|---|------|------|
| E1 | 配置走环境变量 | `.env` + 校验（zod / @nestjs/config），无硬编码 URL/key/模型名 |
| E2 | 外部能力走 client 封装（D2） | `src/clients/{ragflow,llm,crm,asr}.ts`，业务层只依赖接口 |
| E3 | Prompt 模板独立存放 | `src/prompts/*.txt`，不在代码里写多行 prompt |
| E4 | 关键参数集中配置 | `config/*.ts`：topK、temperature、队列并发等 |
| E5 | 内外路由树物理隔离（D3） | `/api/internal/*` vs `/api/public/*` 独立 NestJS 模块 |
| E6 | 工具/能力集按用户身份装配（D3） | 外部用户拿不到内部 client，不靠 prompt 限制 |
| E7 | API 层脱敏（D4） | 全局拦截器按 `user.is_external/role` 掩码敏感字段 |
| E8 | 测试 | service 层单测 + 每条价值线端到端测；CI 跑 lint+test |
| E9 | 类型安全 | 全程 TS strict；前后端共享 DTO 类型 |
| E10 | 审计 | 外部用户触达内部资源 → 写 AuditLog + 告警 |

---

## 8. 待定决策

| 决策 | 选项 | 状态 |
|------|------|------|
| 后端语言 | Node 全栈 / Node+Python 边缘 | ✅ **定：Node 全栈 TS**（2026-06-22）。Python 仅边缘按需 |
| IdP | 飞书 / 企业微信 / 钉钉 | ✅ **定：飞书 + 企业微信都接**（2026-06-22）。E1.1 做多渠道抽象 |
| CRM 数据源 | 第三方 / 自研 / 混合 | ✅ **定：阶段一接现有第三方 CRM API（只读为主），阶段二自研替换**（2026-06-22）。走 `crmClient` 抽象，厂家无关 |
| RAGFlow 知识库切分 | 按产品 / 按客户 / 按权限 | 待 §4.1 实测后定 |
| 对象存储 | MinIO 本地 / 云 OSS | 开发 MinIO，生产再定 |
| LLM 供应商 | 百炼 / 其他 | 沿用现有（走 client 封装可换） |

---

## 9. 下一步

1. **M0 闸门**：RAGFlow 起容器 → 传 IP-Guard 文档 → 跑 3-query 实测
2. 实测过关 → 定 §4.1 RAGFlow client 契约
3. 起 NestJS + Next.js + Prisma + Postgres 骨架
4. 按里程碑 M1→M4 推进
5. 各模块详细 spec 按需展开（本任务书是总纲，不含逐模块功能规格）

---

_V1.0 | 2026-06-22 | 总纲文档，逐模块 spec 另起_

