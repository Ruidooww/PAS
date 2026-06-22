# Codex 执行任务：E0 工程基建（PAS monorepo 骨架）

> 你是冷启动 executor。规格见同目录 [E0-工程基建.md](E0-工程基建.md) 与总纲 [../../PAS-任务书-V1.0.md](../../PAS-任务书-V1.0.md) §3/§5/§7。本文件补充"怎么落地"的硬细节，照做即可。完成后开 PR，由 orchestrator(Claude) 审 + 本地集成测试。

## 仓库 & 落点
- 仓库：`Ruidooww/PAS`（私有），当前根目录有 `LICENSE`、`.gitignore`、`PAS任务书-V1.0-20260622/`（spec 文档）。
- 骨架建在**仓库根**：新增 `apps/`、`packages/`、`pnpm-workspace.yaml`、`docker-compose.dev.yml`、`.env.example`。spec 文档夹保持不动（勿删勿移）。
- 新建分支 `feat/E0-scaffold`，小步提交，最后开 PR。

## 技术栈（已锁定，勿擅改）
pnpm workspace · NestJS(TS, api) · Next.js 15(React+TS, web) · Prisma + PostgreSQL 16 · Redis+BullMQ · MinIO · `@nestjs/config`+zod 配置校验 · 全程 TS strict。

## 目录结构（E0.1）
```
apps/api/    NestJS 后端
apps/web/    Next.js 15 前端
packages/shared/   共享 DTO/类型/枚举（前后端 import，E9 类型安全）
pnpm-workspace.yaml · docker-compose.dev.yml · .env.example
```
`packages/shared` 导出 `User`/`CustomerMirror`/`Proposal`/`KbDocument` 等领域类型；前后端都从它 import，禁止各自重复定义。`pnpm dev` 并发起前后端。

## ⚠️ 端口（E0.3）——这台机器有坑，必须照表来
**本机被占用**：RAGFlow 全栈占 `80/443/1200/3306/6379/9000/9001/19380-19384`。
**更隐蔽**：Windows/Hyper-V 的 WinNAT **保留端口段**会让 bind 失败且报"forbidden by its access permissions"（端口看着空也用不了）。已知保留段含：`6475-7298`、`8063-8162`、`8500-8899`、`9024-9629`、`10740-10939`、`50000-50059`（精确查：`netsh int ipv4 show excludedportrange protocol=tcp`）。
**PAS dev compose 用这些（已验证既不撞 RAGFlow、也不在保留段）**：
| 服务 | 容器端口 | 宿主端口 |
|---|---|---|
| postgres | 5432 | **5544** |
| redis | 6379 | **6399** |
| minio API | 9000 | **9900** |
| minio console | 9001 | **9901** |
- compose 项目名显式设 `name: pas`（避免和别的 `docker/` 栈撞，本机有前科）。
- 每个服务加 healthcheck + 命名数据卷持久化。

## Prisma schema（E0.2）= 任务书 §5 全表
建 `apps/api/prisma/schema.prisma`，按 §5 建：`User`、`CustomerMirror`、`Proposal`、`KbDocument`、`AuditLog`、`ConversationFeedback`。`Opportunity`/`Contract` 阶段一**不建本地表**（读第三方 CRM），只在 `packages/shared` 留领域类型。关键：`Proposal.customer_ref` 指向 `CustomerMirror.ref`；`KbDocument.ragflow_doc_id` 是与 RAGFlow 的唯一关联键；`KbDocument.acl_scope` 为文档级权限留位。首个 migration 建全表。

## 配置体系（E0.4）
`@nestjs/config` 全局 + zod schema 校验，**缺必填 env 启动即 fail fast**（不许静默用默认）。`.env.example` 列全所有键，无默认值的标"必填"。至少含：`DATABASE_URL`、`REDIS_URL`、`MINIO_*`、`RAGFLOW_BASE_URL`、`RAGFLOW_API_KEY`、`LLM_API_KEY`、`LLM_BASE_URL`、`CRM_PROVIDER(external|pas)`、`JWT_SECRET`。

## clients 封装骨架（E0.5）★核心纪律 D2
`apps/api/src/clients/{ragflow,llm,crm,index}.ts`，每个=`interface` + 真实实现 + Mock，业务层只依赖 interface（NestJS DI 注入，按 env 选实现）。
- **ragflow.ts**：接口按任务书 §4.1（`retrieve/chat/graphQuery/listDocs/uploadDoc`）。**起步用 `RagflowClientMock`**（返回假 chunk/答案），真实实现等实测契约定稿再填——不阻塞 E2/E3/E4。
- **llm.ts**：真实接现有云端 API（`LLM_BASE_URL`/`LLM_API_KEY`，OpenAI 兼容即可），+ Mock。
- **crm.ts**：`ExternalCrmClient`(第三方,只读) + `PasCrmClient`(阶段二占位) + Mock，由 `CRM_PROVIDER` 选；厂家无关，勿写死厂家。

## CI（E0.6）
GitHub Actions：`pnpm install` → lint(eslint) → typecheck(tsc) → test(vitest/jest)，PR 触发，全绿才可合。

## DoD（逐条自测后写进 PR 描述）
- [ ] `pnpm dev` 前后端同起，浏览器能开 web 首页
- [ ] `docker compose -f docker-compose.dev.yml up -d` 起 pg/redis/minio，healthcheck 全绿（端口按上表）
- [ ] `pnpm --filter api prisma migrate dev` 建出全部核心表
- [ ] 删一个必填 env，api 启动报错退出（非静默）
- [ ] 业务层注入 `RagflowClientMock` 跑通一个假问答（一个 demo 路由即可）
- [ ] CI 全绿

## 不要做
- 不碰 `PAS任务书-*` spec 文档；不提交任何密钥/`.env`（只提交 `.env.example`）。
- 不做生产部署 compose（E5）、不做监控（v2）。
- RAGFlow 真实 client 不在本任务（用 mock）。
- 别用 5432/6379/9000/9001 等被占端口；别 `docker compose down --remove-orphans`（本机多栈，有前科）。
