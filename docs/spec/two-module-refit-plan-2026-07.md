# PAS 聚焦改造方案：一键方案 + AI 知识库（2026-07）

> 状态：Proposed（PR 待 merge）｜ 日期：2026-07-02
> 决策背景：用户 2026-07-02 拍板——当前只交付两个模块（一键生成方案 PPT+PDF、技术部内部 AI 知识库），其余 M1-M15 排期全部暂停。本文档是当前唯一的执行焦点，取代 `docs/roadmap/pas-full-roadmap-taskbook.md` 的近期施工顺序（该文档保留作为长期蓝图参考，不再驱动派单）。
> 源依据：`PAS任务书-V1.0-20260622/PAS_项目汇报材料_V1.1_202606151503.md.pdf`（三层确定性框架、"不创作只组装"原则）+ `PAS【…】_模块细化路线图_V1.0_202606152017.md`（M7/M14 交付物定义）

## 1. 目标与不做

四周后交付两个内部可用的模块：

1. **技术部 AI 知识库**：检索准（有评测集数字证明）、答案能带截图、引用可溯源。
2. **一键方案**：CRM 客户信息 → 30 分钟内出可直接给客户展示的 PPT + PDF。

**明确不做**：
- 不做 M1-M15 中这两块以外的任何模块（会议/合同/客情/渠道/驾驶舱等全部暂停）。
- 不做 SPA 前端迁移（本期前端改动全部落在现有 Next.js 页面；SPA+Nginx 作为第二期独立立项）。
- 不新增任何 governance / execution / roadmap 类流程文档。

## 2. 现状判定（为什么是"补四块"而不是重写）

对照两份源文档的设计原则审过现有代码（2026-07-02）：

| 已有且方向正确 | 缺失 |
|---|---|
| BullMQ 方案生成流水线（章节 for-loop + 进度推送 + draft→draft_ready 状态机） | **知识块体系**（人工审核/质量分/标签的标准段落库）——最大缺口 |
| 模板 YAML 体系（= Layer 1 结构确定性，已有 2 套 IP-Guard 模板） | **规则引擎**（Layer 3：条件→动作→约束） |
| RAGFlow 检索（gte-rerank-v2 + page_size=30 已调优） | **PPT / PDF 导出**（现只有 md/docx） |
| QA SSE 流式问答 + 引用 + 反馈落库 | **MinIO 文件存储** |
| JWT + 飞书/企微 IdP、CRM CustomerMirror 同步 | **图片链路**（文档截图在入库时丢失） |

核心差距是"哲学层"：现有生成管线是**检索 + AI 自由写作**（靠 prompt 约束兜底），而源文档核心原则是**"不创作只组装"**——80% 人工审核知识块直接填充、15% 规则适配、5% AI 衔接。知识块库与规则引擎缺失时，方案质量上限就是 LLM 发挥，下限没有保障。这也是"方案不能直接给客户看"和"检索不准"的根因。

## 3. 架构改造

```
保留：RAGFlow检索(参数已调优) / BullMQ流水线 / 模板YAML / JWT+IdP / CRM同步 / QA-SSE
新增：
  ① 知识块库   Postgres 为唯一事实源（审核状态/质量分/标签/图片关联），
               发布后同步进 RAGFlow 独立 dataset 做检索（复用已调优混合检索+rerank，
               不另起 pgvector 二套检索栈）；命中后按 chunk id 映射回 Postgres 拿元数据
  ② 图片链路   入库抽图 → MinIO → 图文关联 → qwen-vl 生成描述进检索索引 → 答案带图
  ③ 规则引擎   condition(JSON) → action(注入/排除章节、指定知识块)，作用于模板实例化
  ④ 导出出口   PPTX 模板占位符填充 + HTML→Puppeteer 渲染 PDF → MinIO 存 export_artifact
```

生成管线改造后的章节三档逻辑：

1. 章节命中 published 知识块 → **原文填充**，AI 只写衔接句；
2. 无知识块但有检索结果 → 现有模式生成，章节标记"AI 生成，建议复核"；
3. 都没有 → 输出"[待补充]"。

审阅页对三档做视觉区分，审阅人一眼知道哪些段落可信度高。

## 4. 任务拆解（10 个 Issue，串行派 Codex）

执行顺序按依赖排列（MinIO 提前到图片链路之前）。每个 Issue 的完整验收标准见 GitHub Issue 正文，此处为索引。

| # | 代号 | 内容 | 依赖 |
|---|---|---|---|
| 1 | A 知识块体系 | `knowledge_chunk` 数据模型 + 审核状态机 + CRUD/审核 API + 审核列表页 | 无 |
| 2 | B 评测工装 | 30-50 条 golden set + 自动化评测脚本（recall@k/引用命中率）+ 当前基线报告 | 需用户组织技术部出题 |
| 3 | I MinIO 基建 | docker-compose 加 MinIO + `storageClient` 薄客户端 | 无 |
| 4 | C 检索质量 | 业务词典 + LLM 查询改写 + 评测集回归对比基线 | B |
| 5 | D 图片链路 | 入库抽图→MinIO→图文关联 + qwen-vl 描述进索引 + QA 答案带图 | A、I |
| 6 | E 规则引擎 | `rule` 表 + 求值器 + 模板实例化接入 | A |
| 7 | F 生成管线改造 | 章节三档逻辑（知识块填充/AI生成标记/待补充）+ 审阅页视觉区分 | A、E |
| 8 | G PPTX 导出 | 母版占位符填充引擎 + `export_artifact` 表 | I + 用户提供 PPT 母版 |
| 9 | H PDF 导出 | 方案 JSON→HTML 模板→Puppeteer→PDF | I |
| 10 | J 端到端回测 | 历史方案对比回测 + 技术部试用一周 + 评测集不回退 | 全部 |

## 5. 用户侧前置（不齐会卡）

| 事项 | 需要时间点 |
|---|---|
| 技术部出题：30-50 条真实问题 + 期望答案出处 | Issue B 启动前 |
| PPT 母版：至少 1 套带 `{{占位符}}` 的公司模板 | Issue G 启动前 |
| 知识块首批审核：售前专家审核发布首批 50-100 个知识块 | Issue F 启动前（W2 起持续） |

## 6. 决策点状态

1. **图片描述走云端 qwen-vl（百炼）**：默认方案。IP-Guard 产品截图如判定不可上云，Issue D 降级为"只抽图不描述"（图片仍随知识块展示，但不可被语义检索）。派 Issue D 前与用户最终确认一次。
2. **SPA 迁移**：本期不做，已确认。
3. **知识块检索走 RAGFlow 独立 dataset**（不是 pgvector）：本文档 §3 已定，理由是复用已调优检索栈。

## 7. 协作规则（全部，共三条）

1. 用户拍板、Claude 出方案/写 Issue/审 PR、Codex 实施；一次只跑一个 Issue。
2. 每个 Issue 必须有可演示的验收标准，验收以能演示为准。
3. Claude 不再产出任何 governance/roadmap/gate 类流程文档；要写流程文档必须用户亲口指名。

## 8. Issue 索引（执行顺序）

| 顺序 | Issue | 代号 | 启动条件 |
|---|---|---|---|
| 1 | [#122](https://github.com/Ruidooww/PAS/issues/122) | A 知识块体系 | 即可启动 |
| 2 | [#123](https://github.com/Ruidooww/PAS/issues/123) | B 评测工装 | 技术部题目就位 |
| 3 | [#124](https://github.com/Ruidooww/PAS/issues/124) | I MinIO 基建 | 即可启动 |
| 4 | [#125](https://github.com/Ruidooww/PAS/issues/125) | C 检索质量 | #123 merge |
| 5 | [#126](https://github.com/Ruidooww/PAS/issues/126) | D 图片链路 | #122 + #124 merge；qwen-vl 上云确认 |
| 6 | [#127](https://github.com/Ruidooww/PAS/issues/127) | E 规则引擎 | #122 merge |
| 7 | [#128](https://github.com/Ruidooww/PAS/issues/128) | F 生成管线改造 | #122 + #127 merge；首批知识块已发布 |
| 8 | [#129](https://github.com/Ruidooww/PAS/issues/129) | G PPTX 导出 | #124 merge；PPT 母版就位 |
| 9 | [#130](https://github.com/Ruidooww/PAS/issues/130) | H PDF 导出 | #124 + #129 merge |
| 10 | [#131](https://github.com/Ruidooww/PAS/issues/131) | J 端到端回测 | 全部 merge；历史方案样本就位 |
