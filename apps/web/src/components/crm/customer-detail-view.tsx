"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppShell } from "../shell/app-shell";
import {
  CrmApiError,
  getCustomer,
  getCustomerPortrait,
  listOpportunities,
} from "../../lib/crm/api-client";
import type { CustomerDetail, CustomerPortrait, OpportunitySummary } from "../../lib/crm/types";
import styles from "./crm.module.css";

export function CustomerDetailView({ customerRef }: { customerRef: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [portrait, setPortrait] = useState<CustomerPortrait | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCustomer(customerRef),
      listOpportunities({ customerRef }),
      getCustomerPortrait(customerRef),
    ])
      .then(([cust, oppRes, portraitRes]) => {
        if (!active) return;
        setCustomer(cust);
        setOpportunities(oppRes.items);
        setPortrait(portraitRes);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof CrmApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "加载失败，请稍后重试");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerRef, router]);

  if (loading || error || !customer) {
    return (
      <AppShell
        pageTitle={loading ? "客户详情" : "客户不存在"}
        breadcrumb={[
          { label: "客户", href: "/customers" },
          { label: "客户列表", href: "/customers" },
          { label: customerRef },
        ]}
      >
        {loading ? (
          <div className={styles.loading}>加载中…</div>
        ) : (
          <div className={styles.errorBanner}>{error ?? "客户不存在"}</div>
        )}
      </AppShell>
    );
  }

  const primaryOpp = opportunities[0];
  const generateUrl = primaryOpp
    ? `/proposals/new?customerRef=${encodeURIComponent(customer.ref)}&opportunityRef=${encodeURIComponent(primaryOpp.ref)}`
    : `/proposals/new?customerRef=${encodeURIComponent(customer.ref)}`;

  const initials = customer.name.slice(0, 1);

  return (
    <AppShell
      pageTitle={customer.name}
      pageDescription={`Ref ${customer.ref} · 同步于 ${new Date(customer.syncedAt).toLocaleString("zh-CN")}`}
      breadcrumb={[
        { label: "客户", href: "/customers" },
        { label: "客户列表", href: "/customers" },
        { label: customer.name },
      ]}
      actions={
        <>
          <Link href="/customers" className={styles.filterPill} style={{ textDecoration: "none" }}>
            ← 返回
          </Link>
          <Link
            href={generateUrl}
            style={{
              fontSize: 13,
              padding: "7px 14px",
              borderRadius: 7,
          background: "var(--blue)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            生成方案
          </Link>
        </>
      }
    >
      {portrait && <CustomerPortraitCard portrait={portrait} />}

      <div className={styles.detailGrid}>
        <aside>
          <div className={styles.metaCard}>
            <div className={styles.metaHeader}>
              <div className={styles.metaAvatar}>{initials}</div>
              <div>
                <p className={styles.metaName}>{customer.name}</p>
                <p className={styles.metaSubline}>
                  <span className={styles.tag}>{customer.source}</span>
                </p>
              </div>
            </div>
            <dl className={styles.metaList}>
              <dt>Ref</dt>
              <dd>{customer.ref}</dd>
              <dt>行业</dt>
              <dd>{customer.industry ?? "—"}</dd>
              <dt>规模</dt>
              <dd>{customer.scale != null ? `${customer.scale.toLocaleString()} 人` : "—"}</dd>
              <dt>Owner</dt>
              <dd>{customer.ownerId ?? "—"}</dd>
              <dt>同步</dt>
              <dd>{new Date(customer.syncedAt).toLocaleString("zh-CN")}</dd>
            </dl>
          </div>
        </aside>

        <div className={styles.cardStack}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>关联商机</h2>
              <span className={styles.cardSub}>{opportunities.length} 条</span>
            </div>
            {opportunities.length === 0 ? (
              <div className={styles.empty}>暂无商机</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>商机</th>
                    <th>阶段</th>
                    <th>金额估算</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp) => (
                    <tr key={opp.ref}>
                      <td>
                        <Link className={styles.linkName} href={`/opportunities/${encodeURIComponent(opp.ref)}`}>
                          {opp.title}
                        </Link>
                      </td>
                      <td><span className={styles.tag}>{opp.stage}</span></td>
                      <td>{opp.amountEstimate != null ? `¥${opp.amountEstimate.toLocaleString()}` : "—"}</td>
                      <td>{opp.ownerId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>关联方案</h2>
              <span className={styles.cardSub}>{customer.proposals.length} 条</span>
            </div>
            {customer.proposals.length === 0 ? (
              <div className={styles.empty}>暂无方案</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>方案</th>
                    <th>状态</th>
                    <th>版本</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.proposals.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link className={styles.linkName} href={`/proposals/${encodeURIComponent(p.id)}`}>
                          {p.title}
                        </Link>
                      </td>
                      <td>
                        <span className={styles.statusPill} data-status={p.status}>{p.status}</span>
                      </td>
                      <td>v{p.version}</td>
                      <td>{new Date(p.createdAt).toLocaleDateString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CustomerPortraitCard({ portrait }: { portrait: CustomerPortrait }) {
  const latest = latestActivity(portrait);
  return (
    <section className={styles.portraitCard}>
      <div className={styles.portraitHeader}>
        <div>
          <h2>客户画像</h2>
          <p>
            {portrait.industry ?? "—"} ·{" "}
            {portrait.scale != null ? `${portrait.scale.toLocaleString()} 人` : "—"} · Owner{" "}
            {portrait.ownerId ?? "—"}
          </p>
        </div>
      </div>
      <div className={styles.portraitTiles}>
        <article className={styles.portraitTile}>
          <span>商机</span>
          <strong>{portrait.opportunities.total}</strong>
          <div className={styles.stageBadges}>
            {Object.entries(portrait.opportunities.byStage).map(([stage, count]) => (
              <em key={stage}>{stage}: {count}</em>
            ))}
          </div>
          <p>{formatMoney(portrait.opportunities.totalAmountEstimate)}</p>
        </article>
        <article className={styles.portraitTile}>
          <span>方案</span>
          <strong>{portrait.proposals.total}</strong>
          <p>{portrait.proposals.latestStatus ?? "暂无状态"}</p>
          <p>{formatDate(portrait.proposals.latestUpdatedAt)}</p>
        </article>
        <article className={styles.portraitTile}>
          <span>最新动态</span>
          <strong>{latest.label}</strong>
          <p>{formatDate(latest.value)}</p>
        </article>
      </div>
    </section>
  );
}

function latestActivity(portrait: CustomerPortrait): { label: string; value: string | null } {
  const opportunityTime = portrait.opportunities.latestUpdatedAt;
  const proposalTime = portrait.proposals.latestUpdatedAt;
  if (!opportunityTime && !proposalTime) return { label: "暂无", value: null };
  if (!opportunityTime) return { label: "方案", value: proposalTime };
  if (!proposalTime) return { label: "商机", value: opportunityTime };
  return new Date(opportunityTime) > new Date(proposalTime)
    ? { label: "商机", value: opportunityTime }
    : { label: "方案", value: proposalTime };
}

function formatMoney(value: number): string {
  return `¥${value.toLocaleString("zh-CN")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN");
}
