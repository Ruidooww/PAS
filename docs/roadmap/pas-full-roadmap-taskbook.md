# PAS 完整路线图总任务书

> 日期：2026-06-30
> 状态：Final draft
> 适用范围：PAS V1 已完成基线之后的 2.0 / 2.x / 3.0 / 4.0 路线拆解、issue 清账与后续 Codex 派单。
> 核心原则：路线图全量覆盖 `M1-M15`，工程执行只推进已解锁、已对齐、可验证的近期阶段。

## 1. 总目标

PAS 的路线图不是单个 issue 队列，而是完整产品蓝图。后续所有工程任务必须从模块路线图出发，再落到 issue。

本任务书要解决三件事：

1. 把已完成的 V1 / v1.5 能力归位。
2. 把 `#77-#108` 过渡区重新清账，避免继续按旧 `v2.0` milestone 误派。
3. 明确从 `2.0` 到 `4.0` 每个阶段要完成什么、不能做什么、依赖什么。

## 2. 路线图资料关系

| 资料 | 定位 |
|---|---|
| `PAS 模块细化路线图 V1.0` | 最终产品蓝图，覆盖 `M1-M15` |
| `PAS-能力全景-完整源对照.md` | 全能力登记，标注 MVP / v2 / 预留 |
| `PAS-任务书-V1.0.md` | V1 MVP 施工边界 |
| `PAS-任务清单-V1.0.md` | V1 工程拆解，形成 `E0-E5` |
| `docs/execution/*` | Codex 执行纪律、阶段边界、越级拦截 |
| GitHub Issues | 具体施工单或业务输入，不自动等同路线图 |

解释规则：

```text
路线图 = PAS 最终要长成什么样
能力全景 = 哪些能力本阶段做，哪些只是登记
任务书 V1.0 = 第一阶段施工范围
docs/execution = Codex 当前执行边界
issue = 当前可执行或待确认的工作项
```

## 3. 当前已完成基线

截至当前 `origin/main`，PAS 已经不是空白 V1，而是 V1 主链路基本完成，并混入了部分 V2 早期能力。

| 模块 / Epic | 已完成内容 |
|---|---|
| `E0` 工程基建 | pnpm monorepo、NestJS API、Next.js Web、Prisma、Postgres、Redis、CI、dev/prod compose、SOP |
| `E1 / M9` 权限基座 | 飞书/企微 IdP scaffold、JWT、RBAC、内外路由隔离、文档级 ACL、脱敏、审计 |
| `E2 / M1 / M7` 售前问答 | RAGFlow client、QA SSE、引用、反馈、QA 前端、真实链路收尾、首字时间评估 |
| `E3 / M14` 方案生成 | 需求结构化、模板体系、BullMQ 生成、方案 CRUD、版本、Markdown/Word 导出、方案前端 |
| `E4 / M2` 客户/商机 | `crmClient`、客户/商机读取、Redis 缓存、客户/商机前端、方案关联 |
| `E5` 内测上线 | E2E smoke、生产部署、反馈看板 |
| `M6` AI 能力 | `llmClient`、prompt 外置、runtime config、provider boundary guard |
| `M7` 知识库早期 V2 | `#108` 已合入 `M7.1 KG base`，包含 4 类实体、关系表、抽取 worker、internal KG API 与测试 |
| `M9` 业务输入 / 工程实施 | `#78/#102` 已合入 M9 权限矩阵 spec；`#88` 已完成 3 类 `[human-signed]` 与 5 trace PASS；`#109` 已 squash 合入 main (`9673cbc`)，`#88` 已关闭；M9.1 B+ scope（4 roles × 4 resources × read/write + 内容级 ACL + audit）落地 |
| `M15` 业务输入 | `#77/#101` 已合入客情 8 维 spec；工程实施仍需独立 human-signed 路线确认 |
| 治理层 | `#95-#107` 已合入执行文档、PR/issue 模板、guard、agent-signed 规则 |

## 4. 过渡区判定

`#77-#109` 是混乱过渡区，不再按编号线性解释路线。

| Issue / PR | 重新定性 |
|---|---|
| `#77/#101` | `M15` 业务输入 spec，保留，但不自动解锁工程实施 |
| `#78/#102/#107` | `M9` 业务输入与签字规则适配，保留 |
| `#83/#108` | 已合入的 V2 早期 runtime，归入 `M7`，冻结扩张，待 `2.2` 消化 |
| `#84-#87` | `M14` 后续 backlog，不属于 2.0 清账阶段直接施工 |
| `#88/#109` | `#109` 已 squash 合入 main (`9673cbc`)，`#88` 已关闭；M9.1 B+ scope 实施完成 |
| `#89/#90` | `M9.2/M9.3` 后置，依赖 `#88` 稳定 |
| `#91/#92` | `M15` 后续工程，继续 blocked，等待 human-signed 路线确认 |
| `#94` | 旧总纲草案，与当前边界冲突，应 supersede |
| `#95-#107` | 治理 PR，保留，不回滚 |

## 5. 定稿路线骨架

```text
2.0 路线对齐与 issue 清账
2.1 M9.1 权限增强
2.2 M7 AI知识库产品化
2.3 M1 售前工作台整合
2.4 M14 方案生成引擎产品化
2.5 M15 客情系统 + M2 商机获取
2.6 M3/M4/M5 业务闭环扩展
2.7 M13 最小可扩展与交付治理
3.0 M10 Agent 与编排
4.0 M8/M11/M12/完整 M13 平台化与增长层
```

关键顺序：

- `M9.1` 已解锁，必须提前到 `2.1`。
- `M7` 先于 `M14`，因为 M14 依赖知识块、标签、质量分、检索评测。
- `M1` 提前到 `2.3`，先整合已完成能力，让售前用户看到主工作台价值。
- `M14 PPT` 受 `#79` 阻塞，不绕过业务模板素材。
- `M15` 工程实施前必须完成 human-signed 路线确认。
- 当前不做 `PluginManager`，继续使用 `client interface + adapter`。
- `M11` 后移到 4.x，等待模块数据沉淀。

## 6. PAS 2.0 路线对齐与 issue 清账

### 目标

把仓库从 issue 驱动拉回路线图驱动，建立后续所有任务的事实源。

### 范围

覆盖 `M1-M15`、`#77-#109` 过渡区、现有 open issues、`docs/execution/*` 与旧 `docs/issue-board.md`。

### 任务拆解

| 子任务 | 内容 | 交付物 |
|---|---|---|
| `2.0-A` | 本总任务书即正式路线图源头，取代 `#94`；不再另建 `pas-2.0-roadmap.md` | `docs/roadmap/pas-full-roadmap-taskbook.md` |
| `2.0-B` | 在本总任务书内维护 `M1-M15` 模块台账；不再另建 `module-alignment.md` | 本文件 §3、§5-§15 |
| `2.0-C` | 清账 open issues，重标阶段、blocked 原因和执行类型 | GitHub issue 评论 / label / milestone 调整 |
| `2.0-D` | 对齐 `docs/execution/*` 与新版路线 | `current-phase.md` / `phase-boundaries.md` 更新 |
| `2.0-E` | 归位 `#108 M7.1 KG base` | 路线图和台账中标记为已合入 V2 早期能力 |

### 现有 issue 处理

| Issue | 处理 |
|---|---|
| `#79` | 保留为 `M14 PPT` business blocker |
| `#80` | 保留为后续业务闭环 meta，不作为 2.0 施工 |
| `#81` | 改归 `3.0 M10 Agent 与编排` parent meta |
| `#82` | 保留为 `3.0 not-doing` 决策记录 |
| `#84` | 归入 `2.4 M14`，执行前必须确认 M7 基线 |
| `#85` | 归入 `2.4 M14 PPT`，受 `#79` 阻塞 |
| `#86` | 归入 `2.4 M14` 后段，依赖 `#84` |
| `#87` | 后移到数据闭环，不进入近期施工 |
| `#88/#109` | `#109` 已 open；`#88` 保留到 `#109` 合并后关闭，期间清理过时 `blocked` 与关联状态 |
| `#89/#90` | 保留但后置，依赖 `#88` 稳定 |
| `#91/#92` | 保留但继续 blocked，等待 M15 human-signed 路线确认 |
| `#94` | 关闭或标记 superseded |

### 验收

- 每个 open issue 都有明确阶段、执行类型、blocked 原因。
- 旧 `v2.0` milestone 不再混放 M14/M15/M9/M7/业务输入/治理任务。
- Codex 能根据路线图判断哪些 issue 可施工、哪些只能讨论、哪些必须冻结。

### Milestone 命名策略

- GitHub 现有 milestone 名称先保持原样，例如 `v2.0`、`v2.5`、`v3.0-not-doing`。
- 本任务书中的 `2.0`、`2.1`、`2.2` 是路线阶段，不直接等同 GitHub milestone 名。
- `2.0-C` 清账时再决定是否新增细分 milestone；未新增前，用 issue body / label / 评论写明路线阶段，避免把多个阶段继续混在 `v2.0`。

## 7. PAS 2.1 M9.1 权限增强

### 目标

把 V1 的 RBAC + 文档 ACL 升级为字段级、内容级、AI 输出级的最小安全增强。

### 当前状态

- `#78/#102` M9 权限矩阵 spec 已合入。
- `#88` 已完成 3 类 `[human-signed]` 与 5 trace PASS，并已关闭。
- `#109` 已 squash 合入 main (`9673cbc`)，包含初始 B+ scope 实施 + Followup fix (S1+N1+N2 commit `e212bab`)。
- 2.1 阶段主要工程完成；剩余 followup（N3 demo-qa 收紧 / S2 list N+1 批量化）归入 2.2 消化阶段统一处理，不再独立拆 issue。

### 任务拆解

| 子任务 | 内容 | 状态 |
|---|---|---|
| `2.1-A` | 复核 `#109` final diff，确认只做 M9.1，不解锁 `#89/#90` | ✅ 已完成 |
| `2.1-B` | 补 S1 fail-open fix（删除 ALS，retrieve(params, userClaims) 必填） | ✅ commit `e212bab` |
| `2.1-C` | 补 N1（chunkSensitivityMap 双形态）/ N2（audit createMany）fix | ✅ commit `e212bab` |
| `2.1-D` | 复跑 guard / lint / typecheck / test / e2e / CI | ✅ 全绿 |
| `2.1-E` | 合并 `#109` 后关闭 `#88`，并清理 `blocked` / milestone / linked issue 状态 | ✅ 已完成 |

### 不做

- 不做完整 ABAC engine。
- 不做项目组隔离 runtime。
- 不做 OPA/ReBAC。
- 不做外部分享、水印、导出权限全量实现。

### 关联 issue

- 主 issue：`#88`
- 后置：`#89/#90`

### 验收

- 字段级 ACL、内容级 ACL、AI 输出过滤都有覆盖测试。
- 无权字段和高敏 chunk 不进入 LLM 上下文。
- 审计记录不泄露敏感原文。
- `pnpm guard`、相关测试通过。

## 8. PAS 2.2 M7 AI知识库产品化

### 目标

把 RAG 从“能查”变成“可维护、可评估、可追溯”的知识库能力。

### 当前状态

- 已有 RAGFlow client、QA citation、KbDocument sync、gate harness。
- `#108` 已合入 M7.1 KG base，是已合入 runtime，不是原型。

### 任务拆解

| 子任务 | 内容 |
|---|---|
| `2.2-A` | 知识块体系设计：chunk、标签、版本、质量分、来源 |
| `2.2-B` | 检索评测常态化：固定 query set、召回、引用、回归报告 |
| `2.2-C` | 消化 `#108`：实体来源、抽取触发、失败回滚、人工校验 |
| `2.2-D` | 知识回流最小闭环：方案引用、用户反馈、人工标注 |
| `2.2-E` | M7 对 M14 的接口契约：标签、质量分、引用、可用知识块 |

### 不做

- 不做完整行业知识图谱平台。
- 不做多模态知识平台。
- 不继续新增图谱能力，直到 `2.2-C` 完成。

### 关联 issue

- 已合：`#83/#108`
- 新拆：待从 `2.2-A` 开始建 issue

### 验收

- M14 能稳定消费知识块、标签、质量分。
- gate harness 能输出可复用报告。
- `#108` 不被推倒重写，也不继续无边界扩张。

## 9. PAS 2.3 M1 售前工作台整合

### 目标

把已完成的 QA、方案、客户/商机、反馈能力整合成售前日常入口。

### 当前状态

- 已有 QA 页面、方案页面、客户/商机页面、反馈看板、方案工作台基础。

### 任务拆解

| 子任务 | 内容 |
|---|---|
| `2.3-A` | 售前工作台首页：客户、商机、问答、方案、待办统一入口 |
| `2.3-B` | 客户详情整合：画像占位、历史方案、问答记录、商机、推荐动作 |
| `2.3-C` | 主路径串联：客户/商机 -> 需求 -> 检索 -> 方案 -> 导出 |
| `2.3-D` | 竞品分析轻量入口：基于 KB 检索与结构化对比 |
| `2.3-E` | 蓝图、测试手册、巡检手册模板化入口 |

### 不做

- 不做复杂驾驶舱。
- 不做完整 M15 客情 runtime。
- 不做自动会议或合同流。

### 验收

- 售前用户能从一个入口完成主要路径。
- 不破坏现有 QA / proposal / CRM 页面。
- 桌面与移动端布局不重叠、不溢出。

## 10. PAS 2.4 M14 方案生成引擎产品化

### 目标

把“能生成方案”升级为“可控、可复用、可评估的方案引擎”。

### 当前状态

- 已有需求结构化、单模板、BullMQ 生成、CRUD、版本、Markdown/Word 导出。
- `#79` PPT 模板素材未交付，PPT 线 blocked。
- `M7` 知识块体系必须先达到可供 M14 消费的状态。

### 任务拆解

| 子任务 | 内容 | 关联 |
|---|---|---|
| `2.4-A` | M14.1 三层确定性框架 + 模板 CRUD | `#84` |
| `2.4-B` | 方案质量检查：引用覆盖、结构完整、敏感内容、重复段落 | 新拆 |
| `2.4-C` | 章节级重生成、人工确认、版本对比 | 新拆 |
| `2.4-D` | PPT 大纲 / 页面草稿 | 受 `#79` 部分影响 |
| `2.4-E` | PPT 自动转换引擎 | `#85`，blocked by `#79` |
| `2.4-F` | 规则 DSL | `#86`，后置 |
| `2.4-G` | Outcome Learning 数据采集 | `#87`，后置 |

### 不做

- 不做 LoRA 微调。
- 不做全自动 PPT 引擎绕过 `#79`。
- 不做规则引擎大而全重写。

### 验收

- 方案生成依赖 M7 的知识块和质量分。
- 模板、章节、变量、规则都有版本可追踪。
- PPT 线没有模板素材时只能做大纲/草稿，不进入正式导出。

## 11. PAS 2.5 M15 客情系统 + M2 商机获取

### 目标

让 PAS 有客户上下文和商机输入能力，而不是只被动问答和生成方案。

### 当前状态

- 已有 `crmClient` 和客户/商机前端。
- `#77/#101` 已有 M15 8 维 spec，但当前仍需 human-signed 路线确认。
- `#91/#92` 不能直接派工程实施。

### 前置解锁

必须先完成：

- M15 human-signed 路线确认。
- 明确 M15 进入当前路线的范围：只做 CRM / 方案交互 / 人工录入，还是包含邮件 / 招投标。
- 明确合规边界：数据源、脱敏、审计、外部分享。

准入方式：新建独立 `M15 路线准入 / admission` issue，由业务方在该 issue 评论区以 `[human-signed]` 明确 M15 是否进入当前路线、准入范围和排除范围；`#91/#92` 只能在该准入 issue 通过后解除 blocked，不作为准入签字 issue 本身。

### 任务拆解

| 子任务 | 内容 |
|---|---|
| `2.5-A` | 新建 `M15 路线准入 / admission` issue，完成 human-signed + 工程解锁条件 |
| `2.5-B` | CustomerSignal 最小 schema，先接 CRM / 方案交互 / 人工录入 |
| `2.5-C` | 8 维画像 runtime，先做卡片 / 简报，不做图谱 UI |
| `2.5-D` | 商机结构化录入：文本/表单 -> AI 提取 -> 人工确认 -> 入库 |
| `2.5-E` | 客情信号影响方案模板、知识块、话术建议 |

### 后置

- 邮件采集
- 招投标采集
- 8 类预警规则
- 客情 -> 方案 -> 商机完整联动

### 关联 issue

- `#91/#92`：保留但继续 blocked，待 `2.5-A` 完成后拆小。

## 12. PAS 2.6 M3/M4/M5 业务闭环扩展

### 目标

补齐售前前后关联场景，形成从会议、合同到售后维保的业务入口。

### 当前状态

基本未做，可复用 M1/M7/M9/M14/M15 底座。

### 任务拆解

| 模块 | 任务 |
|---|---|
| `M3` 会议场景 | 会议纪要、会后需求提取、会后方案草稿 |
| `M4` 合同与财务 | 合同风险扫描、合同状态、回款/发票基础信息 |
| `M5` 售后维保 | 维保提醒、售后问答专区、续约提醒 |

### 不做

- 不做实时会议 Bot。
- 不做完整合同审批流。
- 不做完整工单系统。

### 关联 issue

- `#80` 可保留为后续业务闭环 parent meta，但需要重写为新版路线下的 2.6 meta。

## 13. PAS 2.7 M13 最小可扩展与交付治理

### 目标

让系统可配置、可部署、可运维、可逐步扩展，但不进入平台化。

### 当前状态

已有 client abstraction、Docker、SOP、guard、CI。

### 任务拆解

| 子任务 | 内容 |
|---|---|
| `2.7-A` | 产品/方案模板注册表 |
| `2.7-B` | provider 配置治理，继续 `client interface + adapter` |
| `2.7-C` | Open API / webhook 最小预留 |
| `2.7-D` | 管理后台：模板、知识库、权限、反馈、运行配置 |
| `2.7-E` | 备份、升级、故障排查、版本发布流程 |

### 不做

- 不做 PluginManager。
- 不做插件市场。
- 不做热加载。
- 不做第三方插件生态。

## 14. PAS 3.0 M10 Agent 与编排

### 目标

在 2.x 模块稳定后，引入 Agent Runtime、Tool Registry、Skill 管理和业务流转自动化。

### 当前状态

- 有 `agentClient` stub。
- FastGPT 留座。
- `#81` 是 M10 meta，但当前 milestone 应从 `v2.5` 改到 3.0。
- `#82` 是明确不做范围，保留约束。

### Readiness gate

进入 3.0 前必须满足：

- `M9` 权限边界可保护 tool execution。
- `M7` 知识库和检索评测稳定。
- `M14` 方案生成 API、模板体系稳定。
- `M15` 客情数据可被 Agent 安全读取。
- `M1` 工作台有明确用户路径。

判定方式：`3.0` readiness gate 由业务方在 `#81` 评论区以 `[human-signed]` 解锁；评论必须逐条引用上述 5 个前置条件对应的 PR / issue / 验证结果，Codex 只能准备 gate checklist，不能自行宣布 3.0 解锁。

### 任务拆解

| 子任务 | 内容 | 状态 |
|---|---|---|
| `3.0-A` | Agent readiness gate | 可先建 meta |
| `3.0-B` | Agent Runtime skeleton：task/state/progress/audit | blocked |
| `3.0-C` | Tool Registry + guarded tool execution | blocked by M9 |
| `3.0-D` | Skill 注册、版本、审核、启用/禁用、权限 | blocked |
| `3.0-E` | 售前 -> 实施交接包 | blocked by M1/M14/M15 |
| `3.0-F` | 需求单流转 | blocked by M3/M5 |
| `3.0-G` | FastGPT 复测与接入决策 | blocked by readiness |

### 不做

- 不做 Multi-Agent。
- 不做 Workflow Engine。
- 不做 Marketplace。
- 不做多租户平台化。

## 15. PAS 4.0 平台化与增长层

### 目标

从内部 PAS 工具升级为可扩展平台和增长层。

### 覆盖模块

- `M8` 多渠道
- `M11` 经营驾驶舱
- `M12` 渠道管理
- 完整 `M13`
- Multi-Agent / Workflow / Marketplace / Tenant Isolation

### 前置条件

- `M1-M7/M9/M14/M15` 形成稳定数据和流程。
- 业务规模证明看板、多渠道、渠道管理有实际价值。
- 存在明确外部客户、渠道或平台化需求。

### 任务方向

| 模块 | 方向 |
|---|---|
| `M8` | 多渠道统一消息网关、客户门户、飞书/企微/微信/Web |
| `M11` | 销售漏斗、团队业绩、产品组合、知识质量、客情指标 |
| `M12` | 渠道商、专属报价、商机报备、返利、授权区域 |
| 完整 `M13` | Plugin Registry、Marketplace、低代码、计费、组织树、多租户 |

### 不做时机

当前 2.x / 3.0 阶段均不施工 4.0 runtime。

## 16. Issue 迁移与关闭建议

| Issue | 建议动作 |
|---|---|
| `#94` | 关闭，评论说明 superseded by full roadmap taskbook |
| `#79` | 保留，business blocker |
| `#80` | 重写为 `2.6 M3/M4/M5 业务闭环扩展` meta |
| `#81` | 改为 `3.0 M10 Agent 与编排` parent meta |
| `#82` | 保留为 not-doing 决策记录 |
| `#84` | 重标到 `2.4 M14`，blocked by `2.2 M7` 和 `#79` 的 seed-data 部分 |
| `#85` | 重标到 `2.4 M14 PPT`，blocked by `#79` |
| `#86` | 重标到 `2.4 M14` 后段，blocked by `#84` |
| `#87` | 后移，不进入近期施工 |
| `#88/#109` | `#109` 已 squash 合入 main (`9673cbc`)，`#88` 已关闭；剩余 N3（demo-qa `system_service` role 收紧）和 S2（list N+1 ACL query 批量化）作为 followup |
| `#89/#90` | 保留但后置，blocked by `#88` |
| `#91/#92` | 保留但继续 blocked，blocked by M15 human-signed 路线确认 |

## 17. 近期执行顺序

```text
1. ✅ 新建 / 更新 2.0 路线对齐 meta issue（本任务书 PR #110 合入承担）
2. ✅ 关闭或 supersede #94（已 closed 并加 supersede 评论指向本任务书）
3. ✅ 在本总任务书内补齐 M1-M15 模块台账（§3 + §5-§15）
4. ⏳ 清账 #79-#92 的 milestone / blocked / meta 归属（待执行）
5. ✅ 合并 PR #109 fix commit 后关闭 #88（commit `9673cbc`，含 followup `e212bab`）
6. ⏳ 执行 2.2 M7 知识库产品化（含 #108 消化、N3/S2 followup）
7. ⏳ 再进入 2.3 M1 工作台与 2.4 M14
```

近期不执行：

- `#84-#87` M14 runtime
- `#91/#92` M15 runtime
- `#81` M10 Agent runtime
- 任何 PluginManager / Workflow Engine / Marketplace / Multi-Agent / 多租户实现

## 18. 回滚策略

当前不建议整体回滚。

保留：

- `#95-#107` 治理 PR
- `#77/#78` 业务输入
- `#83/#108` M7.1 KG base

处理：

- `#94` supersede
- `#84-#92` 重标阶段和 blocked 原因
- `#108` 冻结扩张，待 `2.2 M7` 消化

只有当 `#108` 明确影响 migration、测试或产品方向成本过高时，才单独开 `disable/revert M7.1 KG base` PR。

## 19. 交付与验证要求

2.0 清账阶段优先文档和 issue 治理，不改业务代码。

最低验证：

```powershell
git diff --check
pnpm guard
```

如果进入工程实现阶段，按影响面追加：

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm e2e
```

PR 描述必须包含：

- 当前阶段
- 修改范围
- Boundary Check
- 验证命令与结果
- API / DB / schema / config 影响
