"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppShell } from "../shell/app-shell";
import { CrmApiError, listCustomers } from "../../lib/crm/api-client";
import type { CustomerSummary } from "../../lib/crm/types";
import styles from "./crm.module.css";

export function CustomerListView() {
  const router = useRouter();
  const [items, setItems] = useState<CustomerSummary[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listCustomers({ q: q || undefined, ownerId: ownerId || undefined, page })
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
  }, [q, ownerId, page, router]);

  const owners = useMemo(() => {
    const set = new Set(items.map((i) => i.ownerId).filter((v): v is string => !!v));
    return Array.from(set);
  }, [items]);

  return (
    <AppShell
      pageTitle="客户列表"
      pageDescription="来自 mock / external CRM 的客户数据，可按名称、Owner 进行筛选与方案跳转。"
      breadcrumb={[{ label: "客户", href: "/customers" }, { label: "客户列表" }]}
      actions={
        <Link href="/proposals/new" className={`${styles.linkName}`} style={{
          fontSize: 13,
          padding: "7px 14px",
          borderRadius: 7,
          background: "#0a84ff",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 500,
        }}>
          + 新建方案
        </Link>
      }
    >
      <div className={styles.statSection}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>客户总数</div>
          <div className={styles.statValue}>{items.length}</div>
          <div className={styles.statHint}>当前页</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>外部 CRM 来源</div>
          <div className={styles.statValue}>{items.filter((i) => i.source === "external").length}</div>
          <div className={styles.statHint}>同步自 mock</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Owner 数</div>
          <div className={styles.statValue}>{owners.length}</div>
          <div className={styles.statHint}>不同负责人</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>当前页</div>
          <div className={styles.statValue}>{page}</div>
          <div className={styles.statHint}>每页 20 条</div>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.filterRow}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="搜索客户名称…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="按 Owner ID 筛选"
          value={ownerId}
          onChange={(e) => {
            setOwnerId(e.target.value);
            setPage(1);
          }}
          style={{ minWidth: 180 }}
        />
        <span className={styles.toolbarSpacer} />
        <button className={styles.filterPill} onClick={() => { setQ(""); setOwnerId(""); }}>
          重置筛选
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>客户</h2>
          <span className={styles.cardSub}>{loading ? "加载中…" : `共 ${items.length} 条`}</span>
        </div>
        {loading ? (
          <div className={styles.loading}>加载中…</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>暂无客户数据</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>名称</th>
                <th>行业</th>
                <th>规模</th>
                <th>Owner</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.ref}>
                  <td>
                    <Link className={styles.linkName} href={`/customers/${encodeURIComponent(c.ref)}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.industry ?? "—"}</td>
                  <td>{c.scale != null ? `${c.scale.toLocaleString()} 人` : "—"}</td>
                  <td>{c.ownerId ?? "—"}</td>
                  <td><span className={styles.tag}>{c.source}</span></td>
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
