"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CrmApiError, getOpportunity } from "../../lib/crm/api-client";
import type { OpportunitySummary } from "../../lib/crm/types";
import styles from "./crm.module.css";

export function OpportunityDetailView({ opportunityRef }: { opportunityRef: string }) {
  const router = useRouter();
  const [opp, setOpp] = useState<OpportunitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOpportunity(opportunityRef)
      .then((data) => {
        if (active) setOpp(data);
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
  }, [opportunityRef, router]);

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

  if (error || !opp) {
    return (
      <div className={styles.shell}>
        <TopBar />
        <main className={styles.content}>
          <div className={styles.errorBanner}>{error ?? "商机不存在"}</div>
          <Link href="/opportunities">← 返回列表</Link>
        </main>
      </div>
    );
  }

  const generateUrl =
    `/proposals/new?customerRef=${encodeURIComponent(opp.customerRef)}&opportunityRef=${encodeURIComponent(opp.ref)}`;

  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.content}>
        <div className={styles.detailGrid}>
          <aside>
            <div className={styles.metaCard}>
              <h3>商机信息</h3>
              <dl className={styles.metaRow}>
                <dt>标题</dt>
                <dd>{opp.title}</dd>
                <dt>阶段</dt>
                <dd>{opp.stage}</dd>
                <dt>金额</dt>
                <dd>
                  {opp.amountEstimate != null
                    ? `¥${opp.amountEstimate.toLocaleString()}`
                    : "—"}
                </dd>
                <dt>Owner</dt>
                <dd>{opp.ownerId ?? "—"}</dd>
              </dl>
              <div className={styles.actions}>
                <Link className={styles.primary} href={generateUrl}>
                  生成方案
                </Link>
              </div>
            </div>
          </aside>

          <div className={styles.card}>
            <h2>关联客户</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>客户 Ref</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Link href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                      {opp.customerRef}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
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
          <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>商机详情</span>
        </div>
      </div>
      <nav className={styles.nav}>
        <Link href="/opportunities">← 商机列表</Link>
      </nav>
    </header>
  );
}
