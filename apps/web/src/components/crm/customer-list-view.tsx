"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    return () => { active = false; };
  }, [q, ownerId, page, router]);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <strong>PAS</strong>
            <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>客户管理</span>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/opportunities">商机列表</Link>
          <Link href="/proposals/new">新建方案</Link>
        </nav>
      </header>

      <main className={styles.content}>
        <div className={styles.card}>
          <h2>客户列表</h2>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <form className={styles.toolbar} onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="搜索客户名称…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            <input
              type="text"
              placeholder="按 Owner ID 筛选"
              value={ownerId}
              onChange={(e) => { setOwnerId(e.target.value); setPage(1); }}
            />
          </form>

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
                      <Link href={`/customers/${encodeURIComponent(c.ref)}`}>{c.name}</Link>
                    </td>
                    <td>{c.industry ?? "—"}</td>
                    <td>{c.scale != null ? c.scale.toLocaleString() : "—"}</td>
                    <td>{c.ownerId ?? "—"}</td>
                    <td>
                      <span className={styles.sourceTag}>{c.source}</span>
                    </td>
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
