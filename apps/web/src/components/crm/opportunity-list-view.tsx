"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CrmApiError, listOpportunities } from "../../lib/crm/api-client";
import type { OpportunitySummary } from "../../lib/crm/types";
import styles from "./crm.module.css";

const STAGES = ["", "prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];

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
    return () => { active = false; };
  }, [stage, page, router]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <strong>PAS</strong>
            <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>商机管理</span>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/customers">客户列表</Link>
          <Link href="/proposals/new">新建方案</Link>
        </nav>
      </header>

      <main className={styles.content}>
        <div className={styles.card}>
          <h2>商机列表</h2>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <div className={styles.toolbar}>
            <select
              value={stage}
              onChange={(e) => { setStage(e.target.value); setPage(1); }}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s === "" ? "全部阶段" : s}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className={styles.loading}>加载中…</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>暂无商机数据</div>
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
                      <Link href={`/opportunities/${encodeURIComponent(opp.ref)}`}>
                        {opp.title}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/customers/${encodeURIComponent(opp.customerRef)}`}>
                        {opp.customerRef}
                      </Link>
                    </td>
                    <td>{opp.stage}</td>
                    <td>
                      {opp.amountEstimate != null
                        ? `¥${opp.amountEstimate.toLocaleString()}`
                        : "—"}
                    </td>
                    <td>{opp.ownerId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.pagination}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </button>
            <span>第 {page} 页</span>
            <button disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
              下一页
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
