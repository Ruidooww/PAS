"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CrmApiError, listCustomers, listOpportunities } from "../../lib/crm/api-client";
import type { CustomerSummary, OpportunitySummary } from "../../lib/crm/types";
import { ProposalApiError, listProposals } from "../../lib/proposal/api-client";
import type { Proposal } from "../../lib/proposal/types";
import { ChatWorkspace } from "../chat/chat-workspace";
import { AppShell } from "../shell/app-shell";
import styles from "./workshop-view.module.css";

export type WorkshopViewId =
  | "customers"
  | "opportunities"
  | "documents"
  | "knowledge"
  | "qa"
  | "analytics"
  | "tasks"
  | "settings";

export const WORKSHOP_VIEW_IDS = [
  "customers",
  "opportunities",
  "documents",
  "knowledge",
  "qa",
  "analytics",
  "tasks",
] as const;

export interface WorkshopViewCard {
  label: string;
  value: string;
}

export interface WorkshopViewConfig {
  id: WorkshopViewId;
  title: string;
  description: string;
  metric: { value: string; label: string };
  cards: WorkshopViewCard[];
  columns: string[];
  emptyText: string;
  sideTitle: string;
  sideItems: Array<{ title: string; body: string }>;
}

export interface WorkshopRow {
  id: string;
  cells: string[];
  href?: string;
}

const VIEW_CONFIGS: Record<WorkshopViewId, WorkshopViewConfig> = {
  customers: {
    id: "customers",
    title: "客户画像",
    description: "查看客户组织、行业、数字化阶段、关键联系人和历史方案记录。",
    metric: { value: "0", label: "客户总数" },
    cards: [
      { label: "战略客户", value: "42" },
      { label: "本月新增", value: "16" },
      { label: "待补全画像", value: "9" },
    ],
    columns: ["客户", "行业", "来源", "负责人"],
    emptyText: "暂无客户数据",
    sideTitle: "客户摘要",
    sideItems: [
      { title: "客户摘要", body: "重点关注数字化深化期客户，优先补齐组织架构和现有系统清单。" },
      { title: "推荐动作", body: "从客户详情进入方案新建，保持 CRM 上下文和方案需求一致。" },
    ],
  },
  opportunities: {
    id: "opportunities",
    title: "商机阶段",
    description: "跟踪从发现需求到方案设计、商务谈判和签约的全过程。",
    metric: { value: "0", label: "商机总数" },
    cards: [
      { label: "方案设计", value: "0" },
      { label: "商务谈判", value: "0" },
      { label: "预计赢单", value: "28%" },
    ],
    columns: ["商机", "客户", "金额", "状态"],
    emptyText: "暂无商机数据",
    sideTitle: "阶段提醒",
    sideItems: [
      { title: "阶段提醒", body: "进入方案设计阶段的商机应优先完成总体方案与关键功能章节。" },
      { title: "风险点", body: "缺少客户预算确认的商机可能影响预计关闭日期。" },
    ],
  },
  documents: {
    id: "documents",
    title: "方案文档",
    description: "管理方案正文、版本、导出记录和审核意见。",
    metric: { value: "0", label: "进行中" },
    cards: [
      { label: "草稿", value: "0" },
      { label: "已定稿", value: "0" },
      { label: "本月生成", value: "0" },
    ],
    columns: ["文档", "客户", "版本", "状态"],
    emptyText: "暂无方案数据",
    sideTitle: "版本摘要",
    sideItems: [
      { title: "版本管理", body: "进入方案工作台可按章节编辑 Markdown，并查看当前章节引用。" },
      { title: "导出", body: "详情页继续保留 Word 和 Markdown 导出入口。" },
    ],
  },
  knowledge: {
    id: "knowledge",
    title: "知识库",
    description: "沉淀产品白皮书、解决方案、案例和客户问答，用于 RAG 引用。",
    metric: { value: "18,732", label: "知识片段" },
    cards: [
      { label: "产品文档", value: "386" },
      { label: "解决方案", value: "128" },
      { label: "客户案例", value: "74" },
    ],
    columns: ["资料", "类型", "版本", "同步"],
    emptyText: "暂无知识库资料",
    sideTitle: "资料同步",
    sideItems: [
      { title: "资料同步", body: "知识库同步状态正常，近期引用集中在智能制造平台建设资料。" },
      { title: "建议补充", body: "补充工业协议接入和设备数据治理相关案例。" },
    ],
  },
  qa: {
    id: "qa",
    title: "AI 助手",
    description: "围绕方案、客户、商机和知识库进行问答，回答附带引用来源。",
    metric: { value: "82%", label: "引用命中" },
    cards: [
      { label: "本周问答", value: "126" },
      { label: "正向反馈", value: "82%" },
      { label: "拒答率", value: "5%" },
    ],
    columns: ["最近问题", "来源", "状态", "反馈"],
    emptyText: "暂无问答记录",
    sideTitle: "最近引用",
    sideItems: [
      { title: "最近引用", body: "智能制造平台建设白皮书、制造运营平台解决方案。" },
      { title: "反馈", body: "QA 会话继续使用现有流式接口与反馈提交逻辑。" },
    ],
  },
  analytics: {
    id: "analytics",
    title: "数据分析",
    description: "观察商机健康度、方案产出效率、引用质量和团队工作负荷。",
    metric: { value: "5.8k", label: "平均字数" },
    cards: [
      { label: "平均生成耗时", value: "2.4m" },
      { label: "引用覆盖率", value: "87%" },
      { label: "审核返工率", value: "13%" },
    ],
    columns: ["指标", "当前值", "趋势", "说明"],
    emptyText: "暂无分析数据",
    sideTitle: "分析结论",
    sideItems: [
      { title: "分析结论", body: "当前瓶颈在方案评审阶段，建议提前补齐商务边界和实施计划。" },
    ],
  },
  tasks: {
    id: "tasks",
    title: "任务检查",
    description: "把方案生成拆成需求分析、方案设计、评审、商务方案和定稿输出五个步骤。",
    metric: { value: "2/5", label: "当前步骤" },
    cards: [
      { label: "已完成", value: "1" },
      { label: "进行中", value: "1" },
      { label: "待开始", value: "3" },
    ],
    columns: ["任务", "阶段", "状态", "负责人"],
    emptyText: "暂无任务数据",
    sideTitle: "下一步",
    sideItems: [
      { title: "下一步", body: "完成总体方案章节后进入方案评审准备。" },
      { title: "阻塞项", body: "暂无强阻塞，商务方案需等待价格策略确认。" },
    ],
  },
  settings: {
    id: "settings",
    title: "设置",
    description: "配置个人偏好、导出格式、知识库连接和通知策略。",
    metric: { value: "在线", label: "系统状态" },
    cards: [
      { label: "默认语言", value: "中文" },
      { label: "导出模板", value: "标准版" },
      { label: "知识库", value: "正常" },
    ],
    columns: ["配置项", "当前值", "状态"],
    emptyText: "暂无配置项",
    sideTitle: "账户",
    sideItems: [
      { title: "账户", body: "张伟，解决方案部。" },
      { title: "权限", body: "可查看客户、商机、方案与知识库引用。" },
    ],
  },
};

const STATIC_ROWS: Partial<Record<WorkshopViewId, WorkshopRow[]>> = {
  knowledge: [
    { id: "kb-1", cells: ["智能制造平台建设白皮书", "产品文档", "v2.1", "正常"] },
    { id: "kb-2", cells: ["制造运营平台解决方案", "解决方案", "v3.0", "正常"] },
    { id: "kb-3", cells: ["某装备集团智能制造案例", "客户案例", "v1.3", "正常"] },
  ],
  qa: [
    { id: "qa-1", cells: ["总体架构和技术路线", "知识库", "已回答", "正向"] },
    { id: "qa-2", cells: ["实施计划风险", "方案上下文", "已回答", "待反馈"] },
  ],
  analytics: [
    { id: "a-1", cells: ["方案生成完成率", "76%", "上升", "较上周 +8%"] },
    { id: "a-2", cells: ["RAG 引用采纳率", "82%", "稳定", "高相关资料占比提升"] },
    { id: "a-3", cells: ["人工编辑占比", "31%", "关注", "关键章节仍需人工补充"] },
  ],
  tasks: [
    { id: "t-1", cells: ["整理客户关键需求", "需求分析", "已完成", "张伟"] },
    { id: "t-2", cells: ["生成总体方案章节", "方案设计", "进行中", "AI 助手"] },
    { id: "t-3", cells: ["补充实施计划", "方案设计", "待开始", "张伟"] },
    { id: "t-4", cells: ["提交方案评审", "方案评审", "待开始", "李娜"] },
  ],
  settings: [
    { id: "s-1", cells: ["RAGFlow 连接", "localhost:19380", "正常"] },
    { id: "s-2", cells: ["自动保存", "开启", "正常"] },
    { id: "s-3", cells: ["通知", "方案生成完成提醒", "已启用"] },
  ],
};

export function WorkshopView({ viewId }: { viewId: WorkshopViewId }) {
  const router = useRouter();
  const [rows, setRows] = useState<WorkshopRow[]>([]);
  const [config, setConfig] = useState<WorkshopViewConfig>(VIEW_CONFIGS[viewId]);
  const [loading, setLoading] = useState(isDynamicView(viewId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setConfig(VIEW_CONFIGS[viewId]);
    setError(null);

    if (!isDynamicView(viewId)) {
      setRows(STATIC_ROWS[viewId] ?? []);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    loadDynamicRows(viewId)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setConfig((current) => ({ ...current, ...result.configPatch }));
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (
          (err instanceof CrmApiError || err instanceof ProposalApiError) &&
          err.status === 401
        ) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : `无法加载${VIEW_CONFIGS[viewId].title}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, viewId]);

  return (
    <AppShell
      pageTitle={config.title}
      pageDescription={config.description}
      breadcrumb={[{ label: config.title }]}
      actions={viewId === "documents" ? <Link href="/proposals/new">新建方案</Link> : undefined}
    >
      {loading && <div className={styles.statePanel}>正在加载{config.title}...</div>}
      {error && <div className={styles.errorPanel} role="alert">{error}</div>}
      {!loading && !error && (
        <WorkshopViewContent
          config={config}
          rows={rows}
          mainAddon={viewId === "qa" ? <EmbeddedQa /> : undefined}
        />
      )}
    </AppShell>
  );
}

export function WorkshopViewContent({
  config,
  mainAddon,
  rows,
}: {
  config: WorkshopViewConfig;
  mainAddon?: ReactNode;
  rows: WorkshopRow[];
}) {
  return (
    <div className={styles.view} data-workshop-view={config.id}>
      <section className={styles.mainPanel}>
        <div className={styles.hero}>
          <div>
            <h1>{config.title}</h1>
            <p>{config.description}</p>
          </div>
          <div className={styles.heroMetric}>
            <strong>{config.metric.value}</strong>
            <span>{config.metric.label}</span>
          </div>
        </div>

        <div className={styles.cardsGrid}>
          {config.cards.map((card) => (
            <article className={styles.card} data-workshop-card={card.label} key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.tableCard}>
          <table>
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length}>{config.emptyText}</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.id}-${index}`}>
                        {index === 0 && row.href ? <Link href={row.href}>{cell}</Link> : cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {mainAddon}
      </section>

      <aside className={styles.sidePanel}>
        <div className={styles.sideHeader}>
          <h2>{config.sideTitle}</h2>
        </div>
        <div className={styles.summaryList}>
          {config.sideItems.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function EmbeddedQa() {
  return (
    <section className={styles.qaPanel}>
      <ChatWorkspace />
    </section>
  );
}

function isDynamicView(viewId: WorkshopViewId): boolean {
  return viewId === "customers" || viewId === "opportunities" || viewId === "documents";
}

async function loadDynamicRows(viewId: WorkshopViewId): Promise<{
  rows: WorkshopRow[];
  configPatch: Partial<WorkshopViewConfig>;
}> {
  if (viewId === "customers") {
    const res = await listCustomers({ page: 1 });
    return {
      rows: buildCustomerRows(res.items),
      configPatch: {
        metric: { value: String(res.items.length), label: "客户总数" },
        cards: [
          { label: "外部 CRM", value: String(res.items.filter((item) => item.source === "external").length) },
          { label: "Mock 客户", value: String(res.items.filter((item) => item.source === "mock").length) },
          { label: "待补全画像", value: String(res.items.filter((item) => !item.industry || !item.scale).length) },
        ],
      },
    };
  }

  if (viewId === "opportunities") {
    const res = await listOpportunities({ page: 1 });
    return {
      rows: buildOpportunityRows(res.items),
      configPatch: {
        metric: { value: String(res.items.length), label: "商机总数" },
        cards: [
          { label: "方案设计", value: String(countStage(res.items, "方案设计")) },
          { label: "商务谈判", value: String(countStage(res.items, "商务")) },
          { label: "预计赢单", value: "28%" },
        ],
      },
    };
  }

  const res = await listProposals({ page: 1 });
  return {
    rows: buildProposalRows(res.items),
    configPatch: {
      metric: { value: String(res.items.filter((item) => item.status !== "final").length), label: "进行中" },
      cards: [
        { label: "草稿", value: String(res.items.filter((item) => item.status === "draft").length) },
        { label: "已定稿", value: String(res.items.filter((item) => item.status === "final").length) },
        { label: "本月生成", value: String(res.items.filter((item) => isCurrentMonth(item.createdAt)).length) },
      ],
    },
  };
}

function buildCustomerRows(items: CustomerSummary[]): WorkshopRow[] {
  return items.map((customer) => ({
    id: customer.ref,
    href: `/customers/${encodeURIComponent(customer.ref)}`,
    cells: [
      customer.name,
      customer.industry ?? "-",
      customer.source,
      customer.ownerId ?? "-",
    ],
  }));
}

function buildOpportunityRows(items: OpportunitySummary[]): WorkshopRow[] {
  return items.map((opportunity) => ({
    id: opportunity.ref,
    href: `/opportunities/${encodeURIComponent(opportunity.ref)}`,
    cells: [
      opportunity.title,
      opportunity.customerRef,
      formatMoney(opportunity.amountEstimate),
      opportunity.stage,
    ],
  }));
}

function buildProposalRows(items: Proposal[]): WorkshopRow[] {
  return items.map((proposal) => ({
    id: proposal.id,
    href: `/proposals/${encodeURIComponent(proposal.id)}/workspace`,
    cells: [
      proposal.title,
      proposal.customerRef,
      `v${proposal.version}`,
      proposal.status,
    ],
  }));
}

function countStage(items: OpportunitySummary[], needle: string): number {
  return items.filter((item) => item.stage.includes(needle)).length;
}

function isCurrentMonth(value: string): boolean {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function formatMoney(value: number | null): string {
  if (value == null) return "-";
  if (value >= 10_000) return `¥ ${(value / 10_000).toLocaleString("zh-CN")} 万`;
  return `¥ ${value.toLocaleString("zh-CN")}`;
}
