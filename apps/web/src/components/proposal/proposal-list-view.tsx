"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProposalApiError, listProposals } from "../../lib/proposal/api-client";
import type { Proposal } from "../../lib/proposal/types";
import { AppShell } from "../shell/app-shell";
import crm from "../crm/crm.module.css";

export function ProposalListView() {
  const router = useRouter();
  const [items, setItems] = useState<Proposal[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listProposals({ page })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ProposalApiError && err.status === 401) {
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
  }, [page, router]);

  const draftCount = items.filter((i) => i.status === "draft").length;
  const finalCount = items.filter((i) => i.status === "final").length;

  return (
    <AppShell
      pageTitle="方案列表"
      pageDescription="所有可见方案的统一视图，按创建时间倒序排列。"
      breadcrumb={[{ label: "方案", href: "/proposals" }, { label: "方案列表" }]}
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
      <div className={crm.statSection}>
        <div className={crm.statCard}>
          <div className={crm.statLabel}>方案总数</div>
          <div className={crm.statValue}>{total}</div>
          <div className={crm.statHint}>含所有状态</div>
        </div>
        <div className={crm.statCard}>
          <div className={crm.statLabel}>草稿</div>
          <div className={crm.statValue}>{draftCount}</div>
          <div className={crm.statHint}>当前页</div>
        </div>
        <div className={crm.statCard}>
          <div className={crm.statLabel}>已定稿</div>
          <div className={crm.statValue}>{finalCount}</div>
          <div className={crm.statHint}>当前页</div>
        </div>
        <div className={crm.statCard}>
          <div className={crm.statLabel}>当前页</div>
          <div className={crm.statValue}>{page} / {Math.max(totalPages, 1)}</div>
          <div className={crm.statHint}>每页 20 条</div>
        </div>
      </div>

      {error && <div className={crm.errorBanner}>{error}</div>}

      <div className={crm.card}>
        <div className={crm.cardHeader}>
          <h2 className={crm.cardTitle}>方案</h2>
          <span className={crm.cardSub}>{loading ? "加载中…" : `共 ${total} 条`}</span>
        </div>
        {loading ? (
          <div className={crm.loading}>加载中…</div>
        ) : items.length === 0 ? (
          <div className={crm.empty}>
            暂无方案，
            <Link href="/proposals/new" className={crm.linkName}>
              新建一份 →
            </Link>
          </div>
        ) : (
          <table className={crm.table}>
            <thead>
              <tr>
                <th>方案</th>
                <th>客户</th>
                <th>状态</th>
                <th>版本</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className={crm.linkName} href={`/proposals/${encodeURIComponent(p.id)}`}>
                      {p.title}
                    </Link>
                  </td>
                  <td>
                    <Link className={crm.linkName} href={`/customers/${encodeURIComponent(p.customerRef)}`}>
                      {p.customerRef}
                    </Link>
                  </td>
                  <td>
                    <span className={crm.statusPill} data-status={p.status}>
                      {p.status}
                    </span>
                  </td>
                  <td>v{p.version}</td>
                  <td>{new Date(p.createdAt).toLocaleString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={crm.pager}>
          <span>{total > 0 ? `${total} 条 · 第 ${page} / ${Math.max(totalPages, 1)} 页` : ""}</span>
          <span className={crm.toolbarSpacer} />
          <button className={crm.pagerBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <button className={crm.pagerBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      </div>
    </AppShell>
  );
}
