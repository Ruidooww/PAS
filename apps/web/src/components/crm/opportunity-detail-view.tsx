"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppShell } from "../shell/app-shell";
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
    return () => {
      active = false;
    };
  }, [opportunityRef, router]);

  if (loading || error || !opp) {
    return (
      <AppShell
        pageTitle={loading ? "商机详情" : "商机不存在"}
        breadcrumb={[
          { label: "客户", href: "/customers" },
          { label: "商机管理", href: "/opportunities" },
          { label: opportunityRef },
        ]}
      >
        {loading ? (
          <div className={styles.loading}>加载中…</div>
        ) : (
          <div className={styles.errorBanner}>{error ?? "商机不存在"}</div>
        )}
      </AppShell>
    );
  }

  const generateUrl = `/proposals/new?customerRef=${encodeURIComponent(opp.customerRef)}&opportunityRef=${encodeURIComponent(opp.ref)}`;
  const initials = opp.title.slice(0, 1);

  return (
    <AppShell
      pageTitle={opp.title}
      pageDescription={`Ref ${opp.ref} · 客户 ${opp.customerRef}`}
      breadcrumb={[
        { label: "客户", href: "/customers" },
        { label: "商机管理", href: "/opportunities" },
        { label: opp.title },
      ]}
      actions={
        <>
          <Link href="/opportunities" className={styles.filterPill} style={{ textDecoration: "none" }}>
            ← 返回
          </Link>
          <Link
            href={generateUrl}
            style={{
              fontSize: 13,
              padding: "7px 14px",
              borderRadius: 7,
              background: "#0a84ff",
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
      <div className={styles.detailGrid}>
        <aside>
          <div className={styles.metaCard}>
            <div className={styles.metaHeader}>
              <div className={styles.metaAvatar}>{initials}</div>
              <div>
                <p className={styles.metaName}>{opp.title}</p>
                <p className={styles.metaSubline}>
                  <span className={styles.tag}>{opp.stage}</span>
                </p>
              </div>
            </div>
            <dl className={styles.metaList}>
              <dt>Ref</dt>
              <dd>{opp.ref}</dd>
              <dt>客户</dt>
              <dd>
                <Link className={styles.linkName} href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                  {opp.customerRef}
                </Link>
              </dd>
              <dt>阶段</dt>
              <dd>{opp.stage}</dd>
              <dt>金额</dt>
              <dd>{opp.amountEstimate != null ? `¥${opp.amountEstimate.toLocaleString()}` : "—"}</dd>
              <dt>Owner</dt>
              <dd>{opp.ownerId ?? "—"}</dd>
            </dl>
          </div>
        </aside>

        <div className={styles.cardStack}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>关联客户</h2>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>客户 Ref</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Link className={styles.linkName} href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                      {opp.customerRef}
                    </Link>
                  </td>
                  <td>
                    <Link className={styles.linkName} href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                      查看客户详情 →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>方案历史</h2>
              <span className={styles.cardSub}>需通过客户详情查看完整方案列表</span>
            </div>
            <div className={styles.empty}>
              暂未直接关联，
              <Link className={styles.linkName} href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                跳到客户查看方案 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
