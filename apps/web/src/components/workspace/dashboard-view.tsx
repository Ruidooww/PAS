"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CrmApiError, listCustomers, listOpportunities } from "../../lib/crm/api-client";
import type { CustomerSummary, OpportunitySummary } from "../../lib/crm/types";
import { formatMoney } from "../../lib/format";
import { ProposalApiError, listProposals } from "../../lib/proposal/api-client";
import type { Proposal } from "../../lib/proposal/types";
import { AppShell } from "../shell/app-shell";
import styles from "./dashboard-view.module.css";

export function DashboardView() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      listCustomers({ page: 1 }),
      listOpportunities({ page: 1 }),
      listProposals({ page: 1 }),
    ])
      .then(([customerRes, opportunityRes, proposalRes]) => {
        if (!active) return;
        setCustomers(customerRes.items);
        setOpportunities(opportunityRes.items);
        setProposals(proposalRes.items);
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
        setError(err instanceof Error ? err.message : "无法加载售前总览");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <AppShell
      pageTitle="售前总览"
      pageDescription="集中查看客户、商机、方案生成队列与知识库状态。"
      breadcrumb={[{ label: "总览" }]}
      actions={<Link href="/proposals/new">新建方案</Link>}
    >
      {loading && <div className={styles.statePanel}>正在加载总览数据...</div>}
      {error && <div className={styles.errorPanel} role="alert">{error}</div>}
      {!loading && !error && (
        <DashboardContent
          customers={customers}
          opportunities={opportunities}
          proposals={proposals}
        />
      )}
    </AppShell>
  );
}

interface DashboardContentProps {
  customers: CustomerSummary[];
  opportunities: OpportunitySummary[];
  proposals: Proposal[];
  today?: Date;
}

export function DashboardContent({
  customers,
  opportunities,
  proposals,
  today = new Date(),
}: DashboardContentProps) {
  const activeProposals = proposals.filter((proposal) => proposal.status !== "final");
  const monthGenerated = proposals.filter((proposal) => isSameMonth(proposal.createdAt, today));
  const recentOpportunities = opportunities.slice(0, 5);
  const recentProposals = proposals.slice(0, 4);

  const metrics = [
    {
      id: "opportunities",
      label: "待跟进商机数",
      value: opportunities.length,
      hint: `${customers.length} 个客户上下文`,
    },
    {
      id: "active-proposals",
      label: "进行中方案",
      value: activeProposals.length,
      hint: "草稿 / 生成完成待定稿",
    },
    {
      id: "month-generated",
      label: "本月生成",
      value: monthGenerated.length,
      hint: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
    },
    {
      id: "positive-rate",
      label: "反馈正向率",
      value: "82%",
      hint: "来自 QA 反馈看板",
    },
  ];

  return (
    <div className={styles.dashboard}>
      <section className={styles.mainColumn}>
        <div className={styles.hero}>
          <div>
            <h1>售前总览</h1>
            <p>把客户、商机、方案和知识库动态收束在一个工作台里。</p>
          </div>
          <div className={styles.heroMetric}>
            <strong>{opportunities.length}</strong>
            <span>当前商机</span>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <article className={styles.metricCard} data-dashboard-metric={metric.id} key={metric.id}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.hint}</small>
            </article>
          ))}
        </div>

        <div className={styles.splitGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>近期商机</h2>
              <Link href="/opportunities">查看全部</Link>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>商机</th>
                  <th>客户</th>
                  <th>阶段</th>
                  <th>金额</th>
                </tr>
              </thead>
              <tbody>
                {recentOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={4}>暂无商机数据</td>
                  </tr>
                ) : (
                  recentOpportunities.map((opportunity) => (
                    <tr key={opportunity.ref}>
                      <td>{opportunity.title}</td>
                      <td>{resolveCustomerName(customers, opportunity.customerRef)}</td>
                      <td><span className={styles.pill}>{opportunity.stage}</span></td>
                      <td>{formatMoney(opportunity.amountEstimate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>方案进度</h2>
              <Link href="/proposals">进入方案</Link>
            </div>
            <div className={styles.progressList}>
              {recentProposals.length === 0 ? (
                <p>暂无方案数据</p>
              ) : (
                recentProposals.map((proposal) => (
                  <Link href={`/proposals/${encodeURIComponent(proposal.id)}/workspace`} key={proposal.id}>
                    <strong>{proposal.title}</strong>
                    <span>
                      <em>{proposal.status}</em>
                      <small>v{proposal.version}</small>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      <aside className={styles.sideColumn}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>知识库快讯</h2>
          </div>
          <div className={styles.summaryList}>
            <SummaryItem title="资料同步" body="核心产品白皮书与解决方案案例已同步，引用响应稳定。" />
            <SummaryItem title="推荐补充" body="建议补充工业协议接入、设备数据治理和多工厂协同案例。" />
            <SummaryItem title="最近更新" body="智能制造平台建设资料已进入可引用状态。" />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>待办</h2>
          </div>
          <div className={styles.todoList}>
            <label>
              <input type="checkbox" readOnly checked />
              整理客户关键需求
            </label>
            <label>
              <input type="checkbox" readOnly />
              补全总体方案章节
            </label>
            <label>
              <input type="checkbox" readOnly />
              提交方案评审
            </label>
          </div>
        </section>
      </aside>
    </div>
  );
}

function SummaryItem({ body, title }: { body: string; title: string }) {
  return (
    <div>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function resolveCustomerName(customers: CustomerSummary[], customerRef: string): string {
  return customers.find((customer) => customer.ref === customerRef)?.name ?? customerRef;
}

function isSameMonth(value: string, today: Date): boolean {
  const date = new Date(value);
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}
