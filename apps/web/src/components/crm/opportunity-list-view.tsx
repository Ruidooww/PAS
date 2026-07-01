"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppShell } from "../shell/app-shell";
import { CrmApiError, listOpportunities } from "../../lib/crm/api-client";
import type { OpportunitySummary } from "../../lib/crm/types";
import styles from "./crm.module.css";

const STAGES = ["", "discovery", "qualified", "evaluation", "negotiation", "closed_won", "closed_lost"];

const STAGE_LABEL: Record<string, string> = {
  "": "全部",
  discovery: "需求发现",
  qualified: "已确认",
  evaluation: "评估中",
  negotiation: "商务谈判",
  closed_won: "已赢单",
  closed_lost: "已丢单",
};

export function OpportunityListView() {
  const router = useRouter();
  const [items, setItems] = useState<OpportunitySummary[]>([]);
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listOpportunities({ stage: stage || undefined, page })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setHasNext(res.items.length >= 20);
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
  }, [stage, page, router]);

  const total = items.length;
  const sumAmount = items.reduce((acc, opp) => acc + (opp.amountEstimate ?? 0), 0);

  return (
    <AppShell
      pageTitle="商机管理"
      pageDescription="按阶段筛选商机，跟踪客户购买意向与金额漏斗。"
      breadcrumb={[{ label: "客户", href: "/customers" }, { label: "商机管理" }]}
      actions={
        <Link
          href="/proposals/new"
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
          + 新建方案
        </Link>
      }
    >
      <div className={styles.statSection}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>商机总数</div>
          <div className={styles.statValue}>{total}</div>
          <div className={styles.statHint}>当前筛选</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>金额合计</div>
          <div className={styles.statValue}>¥{sumAmount.toLocaleString()}</div>
          <div className={styles.statHint}>含已估算</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>当前阶段</div>
          <div className={styles.statValue}>{STAGE_LABEL[stage] ?? "全部"}</div>
          <div className={styles.statHint}>筛选条件</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>当前页</div>
          <div className={styles.statValue}>{page}</div>
          <div className={styles.statHint}>每页 20 条</div>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.filterRow}>
        {STAGES.map((s) => (
          <button
            key={s || "all"}
            className={`${styles.filterPill} ${stage === s ? styles.active : ""}`}
            onClick={() => {
              setStage(s);
              setPage(1);
            }}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>商机</h2>
          <span className={styles.cardSub}>{loading ? "加载中…" : `共 ${total} 条`}</span>
        </div>
        {loading ? (
          <div className={styles.loading}>加载中…</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>暂无商机</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>商机</th>
                <th>客户</th>
                <th>阶段</th>
                <th>金额估算</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((opp) => (
                <tr key={opp.ref}>
                  <td>
                    <Link className={styles.linkName} href={`/opportunities/${encodeURIComponent(opp.ref)}`}>
                      {opp.title}
                    </Link>
                  </td>
                  <td>
                    <Link className={styles.linkName} href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                      {opp.customerRef}
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
        <div className={styles.pager}>
          <span>{items.length > 0 ? `${items.length} 条 · 第 ${page} 页` : ""}</span>
          <span className={styles.toolbarSpacer} />
          <button className={styles.pagerBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <button className={styles.pagerBtn} disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      </div>
    </AppShell>
  );
}
