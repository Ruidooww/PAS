"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CrmApiError } from "../../lib/crm/api-client";
import styles from "../crm/crm.module.css";
import { AppShell } from "../shell/app-shell";

export interface FeedbackDashboardPayload {
  range: { from: string; to: string };
  totals: {
    qaCount: number;
    upCount: number;
    downCount: number;
    refusalCount: number;
  };
  rates: {
    upRate: number;
    downRate: number;
    refusalRate: number;
  };
  topDownQueries: Array<{ query: string; downCount: number }>;
  dailyUsage: Array<{ date: string; count: number }>;
}

export async function fetchFeedbackDashboard(): Promise<FeedbackDashboardPayload> {
  const response = await fetch("/api/internal/admin/feedback-dashboard", {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    let message = `Feedback dashboard API error ${response.status}`;
    try {
      const body = (await response.json()) as unknown;
      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
      ) {
        message = (body as { message: string }).message;
      }
    } catch {
      // use fallback
    }
    throw new CrmApiError(response.status, message);
  }
  return (await response.json()) as FeedbackDashboardPayload;
}

export function FeedbackDashboard() {
  const router = useRouter();
  const [data, setData] = useState<FeedbackDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchFeedbackDashboard()
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof CrmApiError && (err.status === 401 || err.status === 403)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "反馈看板加载失败，请稍后重试");
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
      pageTitle="反馈看板"
      pageDescription="汇总内测问答反馈、拒答和每日使用量。"
      breadcrumb={[{ label: "管理" }, { label: "反馈看板" }]}
    >
      {error && <div className={styles.errorBanner}>{error}</div>}
      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : data ? (
        <FeedbackDashboardContent
          data={data}
          expandedQuery={expandedQuery}
          onToggleQuery={(query) => setExpandedQuery((current) => (current === query ? null : query))}
        />
      ) : (
        <div className={styles.empty}>暂无反馈数据</div>
      )}
    </AppShell>
  );
}

export function FeedbackDashboardContent({
  data,
  expandedQuery,
  onToggleQuery,
}: {
  data: FeedbackDashboardPayload;
  expandedQuery: string | null;
  onToggleQuery: (query: string) => void;
}) {
  const linePath = useMemo(() => buildLinePath(data.dailyUsage, 640, 180), [data.dailyUsage]);
  const maxCount = Math.max(1, ...data.dailyUsage.map((point) => point.count));

  return (
    <div className={styles.cardStack}>
      <div className={styles.statSection} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <StatCard label="总问答数" value={data.totals.qaCount.toLocaleString()} hint={rangeLabel(data)} />
        <StatCard label="赞同率" value={formatRate(data.rates.upRate)} hint={`${data.totals.upCount} 条赞同`} />
        <StatCard label="点踩率" value={formatRate(data.rates.downRate)} hint={`${data.totals.downCount} 条点踩`} />
        <StatCard label="拒答率" value={formatRate(data.rates.refusalRate)} hint={`${data.totals.refusalCount} 条拒答`} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>每日使用量</h2>
          <span className={styles.cardSub}>assistant message / day</span>
        </div>
        <div style={{ padding: "18px 18px 12px" }}>
          <svg
            role="img"
            aria-label="每日使用量折线图"
            viewBox="0 0 700 230"
            width="100%"
            height="230"
            preserveAspectRatio="none"
          >
            <line x1="36" y1="190" x2="676" y2="190" stroke="rgba(0,0,0,0.16)" strokeWidth="1" />
            <line x1="36" y1="20" x2="36" y2="190" stroke="rgba(0,0,0,0.16)" strokeWidth="1" />
            <text x="36" y="210" fill="rgba(0,0,0,0.45)" fontSize="11">
              {data.dailyUsage[0]?.date ?? ""}
            </text>
            <text x="610" y="210" fill="rgba(0,0,0,0.45)" fontSize="11">
              {data.dailyUsage[data.dailyUsage.length - 1]?.date ?? ""}
            </text>
            <text x="8" y="24" fill="rgba(0,0,0,0.45)" fontSize="11">
              {maxCount}
            </text>
            {linePath && (
              <path
                d={linePath}
                fill="none"
                    stroke="var(--blue)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
            )}
          </svg>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Top 10 点踩问题</h2>
          <span className={styles.cardSub}>按相同 query 文本聚合</span>
        </div>
        {data.topDownQueries.length === 0 ? (
          <div className={styles.empty}>暂无点踩反馈</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Query</th>
                <th>Count</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.topDownQueries.map((item) => (
                <QueryRow
                  key={item.query}
                  item={item}
                  expanded={expandedQuery === item.query}
                  onToggle={() => onToggleQuery(item.query)}
                />
              ))}
            </tbody>
          </table>
        )}
        <div className={styles.pager}>
          <span>{data.topDownQueries.length} 条</span>
        </div>
      </div>
    </div>
  );
}

export function buildLinePath(
  points: Array<{ date: string; count: number }>,
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  const left = 36;
  const top = 20;
  const innerWidth = width;
  const innerHeight = height - top - 10;
  const max = Math.max(1, ...points.map((point) => point.count));
  return points
    .map((point, index) => {
      const x = left + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
      const y = top + innerHeight - (point.count / max) * innerHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statHint}>{hint}</div>
    </div>
  );
}

function QueryRow({
  expanded,
  item,
  onToggle,
}: {
  expanded: boolean;
  item: { query: string; downCount: number };
  onToggle: () => void;
}) {
  return (
    <>
      <tr data-feedback-row={item.query}>
        <td>{item.query}</td>
        <td>{item.downCount}</td>
        <td>
          <button className={styles.pagerBtn} type="button" onClick={onToggle}>
            {expanded ? "收起" : "展开"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3}>
            <span className={styles.statHint}>完整对话详情将在 phase-2 接入。</span>
          </td>
        </tr>
      )}
    </>
  );
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function rangeLabel(data: FeedbackDashboardPayload): string {
  return `${data.range.from.slice(0, 10)} 至 ${data.range.to.slice(0, 10)}`;
}
