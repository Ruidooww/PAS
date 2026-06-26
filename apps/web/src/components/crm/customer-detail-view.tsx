"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CrmApiError, getCustomer, listOpportunities } from "../../lib/crm/api-client";
import type { CustomerDetail, OpportunitySummary } from "../../lib/crm/types";
import styles from "./crm.module.css";

export function CustomerDetailView({ customerRef }: { customerRef: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCustomer(customerRef),
      listOpportunities({ customerRef }),
    ])
      .then(([cust, oppRes]) => {
        if (!active) return;
        setCustomer(cust);
        setOpportunities(oppRes.items);
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
    return () => { active = false; };
  }, [customerRef, router]);

  if (loading) {
    return (
      <div className={styles.shell}>
        <TopBar />
        <main className={styles.content}>
          <div className={styles.loading}>加载中…</div>
        </main>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className={styles.shell}>
        <TopBar />
        <main className={styles.content}>
          <div className={styles.errorBanner}>{error ?? "客户不存在"}</div>
          <Link href="/customers">← 返回列表</Link>
        </main>
      </div>
    );
  }

  const primaryOpp = opportunities[0];
  const generateUrl = primaryOpp
    ? `/proposals/new?customerRef=${encodeURIComponent(customer.ref)}&opportunityRef=${encodeURIComponent(primaryOpp.ref)}`
    : `/proposals/new?customerRef=${encodeURIComponent(customer.ref)}`;

  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.content}>
        <div className={styles.detailGrid}>
          <aside>
            <div className={styles.metaCard}>
              <h3>客户信息</h3>
              <dl className={styles.metaRow}>
                <dt>名称</dt>
                <dd>
                  {customer.name}
                  <span className={styles.sourceTag}>{customer.source}</span>
                </dd>
                <dt>行业</dt>
                <dd>{customer.industry ?? "—"}</dd>
                <dt>规模</dt>
                <dd>{customer.scale != null ? customer.scale.toLocaleString() : "—"}</dd>
                <dt>Owner</dt>
                <dd>{customer.ownerId ?? "—"}</dd>
                <dt>同步时间</dt>
                <dd>{new Date(customer.syncedAt).toLocaleString("zh-CN")}</dd>
              </dl>
              <div className={styles.actions}>
                <Link className={styles.primary} href={generateUrl}>
                  生成方案
                </Link>
              </div>
            </div>
          </aside>

          <div style={{ display: "grid", gap: 20 }}>
            <div className={styles.card}>
              <h2>关联商机</h2>
              {opportunities.length === 0 ? (
                <div className={styles.empty}>暂无商机</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>商机</th>
                      <th>阶段</th>
                      <th>金额估算</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp) => (
                      <tr key={opp.ref}>
                        <td>
                          <Link href={`/opportunities/${encodeURIComponent(opp.ref)}`}>
                            {opp.title}
                          </Link>
                        </td>
                        <td>{opp.stage}</td>
                        <td>
                          {opp.amountEstimate != null
                            ? `¥${opp.amountEstimate.toLocaleString()}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.card}>
              <h2>关联方案</h2>
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
                          <Link href={`/proposals/${encodeURIComponent(p.id)}`}>
                            {p.title}
                          </Link>
                        </td>
                        <td>
                          <span className={styles.statusPill} data-status={p.status}>
                            {p.status}
                          </span>
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
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>P</span>
        <div>
          <strong>PAS</strong>
          <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>客户详情</span>
        </div>
      </div>
      <nav className={styles.nav}>
        <Link href="/customers">← 客户列表</Link>
      </nav>
    </header>
  );
}
