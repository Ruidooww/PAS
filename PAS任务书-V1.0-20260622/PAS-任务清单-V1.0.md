# PAS 任务清单 V1.0

> 日期：2026-06-22 ｜ 配套 [PAS-任务书-V1.0.md](PAS-任务书-V1.0.md)
> 编号规则：`PAS-E{epic}.{task}`，如 `PAS-E1.3`
> 各模块详细 spec 见 `docs/tasks/pas/` 目录

---

## Epic 总览

| Epic | 名称 | 里程碑 | 阻塞关系 |
|------|------|--------|---------|
| **E0** | 工程基建 | M0 | 无（最先做） |
| **E1** | 权限基座 | M0-M1 | 依赖 E0 |
| **E2** | 售前问答 | M1 | 依赖 E0、E1 |
| **E3** | 方案生成（精简） | M2 | 依赖 E0、E1、E2（复用 RAGFlow client） |
| **E4** | 客户/商机管理 | M3 | 依赖 E0、E1 |
| **E5** | 内测上线 | M4 | 依赖 E2、E3、E4 |

依赖图：

```
E0 工程基建
 ├─→ E1 权限基座
 │     ├─→ E2 售前问答 ─┐
 │     ├─→ E4 客户商机  ├─→ E5 内测
 │     └─→ E3 方案生成 ─┘
 └─(clients 封装供 E2/E3 复用)
```

---

## E0 工程基建（M0）

| 任务 | 目标 | 交付物 | 验收 |
|------|------|--------|------|
| **E0.1** | monorepo 骨架 | pnpm workspace：`apps/api`(NestJS) + `apps/web`(Next.js) + `packages/shared`(共享 DTO) | `pnpm dev` 前后端同起 |
| **E0.2** | Postgres + Prisma | `schema.prisma`（任务书 §5 核心表）+ 首个 migration | `prisma migrate` 建表成功 |
| **E0.3** | 开发环境 compose | `docker-compose.dev.yml`：postgres + redis + minio | 三服务起，健康检查过 |
| **E0.4** | 配置体系 | `config/` + zod 校验，`.env.example` | 缺必填 env 启动即报错 |
| **E0.5** | clients 封装骨架 | `clients/{ragflow,llm}.ts` 接口 + mock 实现 | 业务层只依赖接口；mock 可跑 |
| **E0.6** | CI | lint + typecheck + test 流水线 | PR 触发，全绿才可合 |

> E0.5 的 RAGFlow client 先用 mock，真实实现等实测后（任务书 §4.1）填。E3/E4 不被 RAGFlow 阻塞。

---

## E1 权限基座（M0-M1）

| 任务 | 目标 | 交付物 | 验收 |
|------|------|--------|------|
| **E1.1** | IdP OAuth 登录 | 飞书/企业微信 OAuth + 回调 | 员工浏览器跳转登录成功 |
| **E1.2** | JWT + 守卫 | 签发/校验 + `@CurrentUser()` | 受保护接口无 token 401 |
| **E1.3** | 内外路由树隔离 | `internal/` `public/` 独立 NestJS module | 外部 token 打 internal 路由 403 |
| **E1.4** | RBAC 角色 | 角色枚举 + 守卫装饰器 | 角色不符 403 |
| **E1.5** | 文档级 ACL | `KbDocument.acl_scope` + 检索时过滤 | 无权用户检索不到受限文档 |
| **E1.6** | 脱敏拦截器 | 全局 interceptor 按 `is_external/role` 掩码 | 外部用户响应无明文手机号/金额 |
| **E1.7** | 审计日志 | `AuditLog` 写入 + 外部触内部告警 | 越权访问留痕 |

> 详细 spec：[`tasks/pas/E1-权限基座.md`](tasks/pas/E1-权限基座.md)

---

## E2 售前问答（M1）

| 任务 | 目标 | 交付物 | 验收 |
|------|------|--------|------|
| **E2.1** | RAGFlow client 实测对接 | `retrieve()` + `chat()` 真实实现 | 命中知识库返回 chunk |
| **E2.2** | 问答 API（SSE） | `POST /api/internal/qa`（流式） | 浏览器逐字出答 |
| **E2.3** | 出处引用 | answer 带 `[1][2]` + 来源列表 | 每结论可溯源到文档 |
| **E2.4** | ACL 过滤检索 | retrieve 注入用户可见 doc 范围 | 越权文档不进上下文 |
| **E2.5** | 问答前端 | 聊天界面 + 出处渲染 + 截图展示 | 端到端可问可答 |
| **E2.6** | 反馈收集 | 👍/👎 → `ConversationFeedback` | 反馈入库 |

> 详细 spec：[`tasks/pas/E2-售前问答.md`](tasks/pas/E2-售前问答.md)

---

## E3 方案生成·精简版（M2）

| 任务 | 目标 | 交付物 | 验收 |
|------|------|--------|------|
| **E3.1** | 需求结构化 | 表单 + LLM 辅助补全 → `requirement_json` | 自由文本 → 结构化需求 |
| **E3.2** | 方案模板体系 | 模板定义 + 变量占位 | 至少 1 套 IP-Guard 方案模板 |
| **E3.3** | 生成流水线 | BullMQ worker：检索→组装→LLM 生成 | 异步出方案初稿 |
| **E3.4** | 方案 CRUD + 版本 | `Proposal` 增删改查 + version | 方案可存可改可回溯 |
| **E3.5** | 导出 | Markdown/Word（PPT 后置） | 一键下载方案文档 |
| **E3.6** | 方案前端 | 需求录入 + 生成进度 + 预览修订 | 端到端出方案 |

> 详细 spec：[`tasks/pas/E3-方案生成.md`](tasks/pas/E3-方案生成.md)

---

## E4 客户/商机接入（M3）

> 阶段一接第三方 CRM（只读为主），不自建 CRM。走 `crmClient` 抽象，换源不动业务（D2）。

| 任务 | 目标 | 交付物 | 验收 |
|------|------|--------|------|
| **E4.1** | crmClient 抽象 | `CrmClient` 接口 + `ExternalCrmClient`（第三方）+ `PasCrmClient`/Mock | 切 provider 业务层不报错 |
| **E4.2** | 读客户/商机 | 经 crmClient 读第三方 + Redis 缓存兜底限流 | 拉到真实客户/商机 |
| **E4.3** | PAS 原生扩展 + 关联 | `CustomerMirror` + `Proposal.customer_ref` 关联 + 级联查询 | 方案挂客户并回显 |
| **E4.4** | 前端 | 客户/商机列表（来自第三方）+ 详情（含 PAS 方案）| 可视化 |

> 详细 spec：[`tasks/pas/E4-客户商机.md`](tasks/pas/E4-客户商机.md)

---

## E5 内测上线（M4）

| 任务 | 目标 | 交付物 | 验收 |
|------|------|--------|------|
| **E5.1** | 端到端 smoke | 问答+方案+客户全链路自动化测 | CI 跑通 |
| **E5.2** | 生产部署 | `docker-compose.prod.yml` + 部署 SOP | 内网可访问 |
| **E5.3** | 反馈看板 | feedback 聚合简易看板 | 看到 5 人使用/拒答率 |

---

## 范围外（v2，但 MVP 预留架构座位）

- **智能客服 Agent**（源文档《商业标准化与工程化闭环设计 V3.0》§7"预留"）：对外客服，强隔离（独立知识库 + 数据隔离 + 多租户）。MVP 不做，但 E1.3 public 路由 / E1.1 外部 token / E6 外部能力集隔离要为它设计对。详见任务书 §6.5。
- 其余后置：M3 会议、M4 合同财务、M8 多渠道、M10 Agent 编排、M11 驾驶舱、M12 渠道、M15 客情。

## 执行建议

1. **E0 + E1 必须最先做完**（基建 + 权限，所有模块依赖）
2. E2/E4 可并行（都只依赖 E0/E1）
3. E3 复用 E2 的 RAGFlow client，建议 E2 之后启动
4. **每个 Epic 完成即可独立验收**，不必等全部做完
5. RAGFlow 实测（M0 gate）只阻塞 E2.1，不阻塞其余任务

---

_V1.0 | 2026-06-22 | 配套 4 份模块 spec（E1/E2/E3/E4）_
