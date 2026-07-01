# ADR-003 — PAS 作为 MCP Server 接入 WorkBuddy

> 状态：Proposed ｜ 日期：2026-07-01
> 关联：[ADR-001](./ADR-001-pas-fastgpt-ragflow.md)（D2 原则 + v2 表格已留座"MCP server 暴露（PAS 当 server）"一行）、`apps/api/src/public/qa/*`（现有对外暴露先例）

## 背景

用户公司是腾讯 **WorkBuddy**（`copilot.tencent.com/work`，桌面级 AI Agent 工作台，2026-03-09 全量上线）的代理商。WorkBuddy 支持通过 **MCP 协议 + 自定义 Connector** 接入第三方能力（已有企业微信、腾讯文档、TAPD 等官方连接器）。用户希望探索：PAS 建成后，能否把自己的能力包装成 MCP Server，被 WorkBuddy 的桌面 Agent 当作 Connector 调用。

**方向澄清（重要，不要与 ADR-001 混淆）**：ADR-001 的 D2 原则和三层能力栈里，PAS 是 **client**，RAGFlow/FastGPT/CRM 是被调用的 **server**（能力供应商）。本 ADR 讨论的方向**正好相反**——PAS 自己变成 **server**，WorkBuddy 是 **client / 编排方**。这与 ADR-001 v2 表格里"MCP server 暴露（PAS 当 server）— 让外部 agent 接入 PAS 能力"是同一件事的具体化，此前只是占位，本 ADR 是第一次展开设计。

本 ADR **只做架构设计**，不产出代码、不派 Issue（用户 2026-07-01 明确表态：这次只要设计文档）。

## 现有可复用的先例

仓库里已经有一次"PAS 能力对外暴露给非登录第三方"的实践，可以作为本设计的参照系：

- `apps/api/src/public/qa/public-qa.controller.ts` + `public-qa.service.ts`：一个不需要登录的 `POST /api/public/qa`，内部用固定的 `publicQaUserClaims`（`role: "external"`, `isExternal: true`）去调 `ragflowClient.retrieve`。
- `redact-answer.ts`：对外部答案做手机号/邮箱脱敏 + 保护 markdown 结构（代码块/链接/引用标记不脱敏）。
- `apps/api/src/auth/idp.registry.ts`：已有 `feishu` / `wecom` / `mock` 三种 IdP，`IDP_MODE` 环境变量控制真实/mock 切换。

**关键差异**：`public-qa` 服务的是**匿名外部访客**（redact 是因为不知道调用方是谁，要按最严假设脱敏）。而 WorkBuddy 场景里，调用方是**已登录企业微信/飞书的真实 PAS 内部员工**（销售/售前），只是换了个客户端触达 PAS——**不应该套用 public-qa 的匿名脱敏模型**，而应该做身份透传，按该员工在 PAS 里本来就有的权限返回数据（下文"身份映射"）。这是本 ADR 与 public-qa 先例最重要的分野，设计时不要偷懒直接复用 redact 逻辑。

## 决定

### 架构方向

```
┌─────────────────────────────┐
│  WorkBuddy (腾讯桌面 Agent)   │
│  client / 编排方              │
└──────────┬────────────────────┘
           │ MCP (远程 Connector，走网络而非 stdio)
           ▼
┌─────────────────────────────┐
│  PAS MCP Server (新增)        │
│  协议转换 + 鉴权 + 输出裁剪      │
└──────────┬────────────────────┘
           │ 直接调用既有 service 层（不重复实现业务逻辑）
           ▼
qa.service / customer.service / proposal.service ...
```

MCP Server 是一层**薄 adapter**，复用 `apps/api/src` 里已有的 service（`QaService`、`CustomerService`、`ProposalService` 等），只做协议转换、鉴权、输出裁剪。不新起一套业务逻辑实现，避免和 Next.js 前端调用路径分叉。

### 1. 暴露哪些能力（tool 清单草案，粗粒度起步）

| Tool（草案名） | 对应现有能力 | 备注 |
|---|---|---|
| `pas_qa_ask` | `QaService`（E2 问答，`apps/api/src/qa/qa.service.ts`） | 单轮同步调用，天然适合 MCP tool |
| `pas_customer_lookup` | `CustomerService`（E4 客户商机，`apps/api/src/customer/customer.service.ts`） | 单轮同步调用；返回字段需要按"该员工权限"裁剪，见下文 |
| `pas_proposal_draft` | `ProposalService`（E3 方案生成） | **不适合同步 tool**，见下条 |

**E3 方案生成是已知的设计难点**：按 ADR-001，E3 走 PAS BullMQ 自编排、章节 for-loop，是**异步、多分钟级**的流水线，不是一次 request-response 能返回的。如果直接包成一个同步 MCP tool，WorkBuddy 侧大概率会超时。草案方向是拆成两个 tool：`pas_proposal_start`（创建任务，立即返回 jobId）+ `pas_proposal_status`（轮询/查询结果），而不是假装它能同步返回。这个拆分是否可行还依赖 WorkBuddy 的 MCP 客户端是否支持"先拿 id 后轮询"的调用模式——**未验证，是后续工作里的开放问题**。

### 2. 身份映射（不是发一把共享 API key）

复用 PAS 现有 IdP（`idp.registry.ts` 的 `feishu`/`wecom`），把 WorkBuddy 侧的调用方身份（飞书/企业微信 unionid）映射回 PAS 内部用户，走已有的 `auth.guard` / `roles.guard` 鉴权，而不是给 WorkBuddy 一把"全公司共享"的 API key。

**Why**：WorkBuddy 本身就跑在企业微信/飞书生态下——这是巧合的便利，能直接对齐已有身份体系。如果用共享 key，PAS 没法区分是哪个销售在通过 WorkBuddy 查数据，权限和审计都会失真（谁能看哪个客户的商机、谁能生成哪个客户的方案，都得按人）。

**开放问题（未验证）**：WorkBuddy 的自定义 MCP Connector 配置支持到什么程度的鉴权透传？如果它只支持"整个 connector 一把固定 API key/token"，做不到"每次调用带上具体使用者身份"，那么本节的身份映射方案就无法落地，需要退而求其次（比如退化成粗粒度共享身份，但那样审计和数据边界都要重新设计）。这是**推进前必须先确认的技术前提**，不确认清楚不能进入实施阶段。

### 3. 数据边界

- 员工通过 WorkBuddy 调用 PAS 能力时，返回的数据范围 = 该员工在 PAS UI 里本来就能看到的范围（复用现有 RBAC，不额外放宽也不用 public-qa 的匿名脱敏模型）。
- 但即便权限相同，**返回给外部 Agent 的字段粒度也应该比内部 API 窄**——比如 `pas_customer_lookup` 不应该把整条客户档案（含合同金额、内部备注等）都吐给 WorkBuddy 的 Agent，只给它完成任务需要的字段。具体裁剪到什么粒度，要等 tool 逐个设计时再定，本 ADR 只定原则。

### 4. Server 落地位置（草案，未定案）

倾向在 `apps/api` 内新增一个 MCP adapter 模块（暂命名 `apps/api/src/mcp/`），而不是新起一个独立 app——因为它要直接依赖已有的 NestJS service 实例，起独立进程反而要面对"两份服务实例/两套连接池"的复杂度。**是否需要独立部署（比如安全域隔离、限流独立扩容）留到实施阶段按需评估**，本 ADR 不锁死。

## 后果

### 正向
- 复用 WorkBuddy 已打通的企业微信/飞书/钉钉分发，PAS 不用自建触达渠道就能让销售在桌面 Agent 里直接用上 PAS 能力。
- 身份映射方案如果能落地，审计粒度反而比"只有 PAS 自己前端"时更细（因为 WorkBuddy 侧调用也会落到 PAS 的 auth/audit 体系里）。
- 复用 D2 精神（薄 adapter，不复制业务逻辑），架构一致性不破。

### 反向 / 须监控
- **WorkBuddy Connector 鉴权透传能力未知**——这是最大的不确定性，决定身份映射方案能不能按设计落地（见"开放问题"）。
- E3 方案生成的异步特性和 MCP tool 的同步调用假设有天然张力，`start/status` 两段式拆分需要先验证 WorkBuddy 客户端是否支持。
- 这不只是技术决策，也是业务/渠道决策——腾讯那边是否需要合作资质、代理商身份是否有额外接入权限，需要和腾讯方面单独确认，不在本 ADR 范围内。
- 与 ADR-001 的 v2 排期一致：本 ADR 是 v2 候选，不影响当前 MVP（E0-E5）节奏。

## 后续工作（不在本 ADR 范围，实施前必须先确认）

- [ ] 确认 WorkBuddy 自定义 MCP Connector 的鉴权透传能力（能否按调用方身份而非固定 key）——参考腾讯云开发者社区《WorkBuddy连接外部工具：MCP服务器配置实战》及 WorkBuddy 官方 Connector 文档，必要时直接找腾讯侧确认。
- [ ] 确认 MCP 传输方式（远程 HTTP/SSE vs stdio）在 WorkBuddy 自定义 Connector 里的具体配置形态。
- [ ] 确认 WorkBuddy 的 MCP 客户端是否支持长任务的"创建+轮询"两段式调用（决定 E3 `pas_proposal_start`/`status` 拆分方案是否可行）。
- [ ] 以上确认后，再评估是否作为 v2 Issue 派给 Codex 实施（本 ADR 本身不产出 Issue）。
