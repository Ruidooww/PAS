"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ProposalApiError,
  waitForGeneratedProposal,
} from "../../lib/proposal/api-client";
import {
  generatingReducer,
  initialGeneratingState,
} from "../../lib/proposal/generating-reducer";
import {
  ProposalProgressError,
  streamProposalProgress,
} from "../../lib/proposal/progress-sse";
import type { Proposal } from "../../lib/proposal/types";
import styles from "./proposal.module.css";

interface Props {
  proposalId: string;
}

export function ProposalGeneratingView({ proposalId }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(generatingReducer, initialGeneratingState);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    waitForGeneratedProposal(proposalId, {
      signal: controller.signal,
      onProposal: setProposal,
    })
      .then(() => {
        router.replace(`/proposals/${encodeURIComponent(proposalId)}`);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ProposalApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setLoadError(
          err instanceof Error ? err.message : "无法读取方案，请稍后重试",
        );
      });
    return () => {
      controller.abort();
    };
  }, [proposalId, router]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start", total: 0 });

    streamProposalProgress(proposalId, (event) => dispatch({ type: "progress", event }), {
      signal: controller.signal,
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      if (err instanceof ProposalProgressError && err.status === 401) {
        router.replace("/login");
        return;
      }
      dispatch({
        type: "error",
        message:
          err instanceof Error ? err.message : "进度连接中断，请刷新页面重试",
      });
    });

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [proposalId, router]);

  const completionRatio = useMemo(() => {
    const total = state.total || state.chapters.length;
    if (total === 0) return 0;
    const done = state.chapters.filter((c) => c.status === "completed" || c.status === "failed").length;
    return Math.round((done / total) * 100);
  }, [state.chapters, state.total]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <strong>PAS</strong>
            <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
              方案生成中
            </span>
          </div>
        </div>
        <div>
          <Link href="/proposals/new">新建另一份</Link>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.card}>
          <h2>
            {proposal?.title ?? "方案"}
            <span className={styles.statusPill} data-status={proposal?.status ?? "draft"}>
              {proposal?.status ?? "draft"}
            </span>
          </h2>
          <p className={styles.hint}>
            正在按模板章节生成，已完成 {completionRatio}%（{state.chapters.filter((c) => c.status === "completed").length}/
            {state.total || state.chapters.length}）。生成完毕将自动跳转到详情页。
          </p>

          {loadError && (
            <div className={styles.errorBanner} role="alert">
              {loadError}
            </div>
          )}
          {state.error && (
            <div className={styles.errorBanner} role="alert">
              {state.error}
            </div>
          )}

          <div className={styles.progressList}>
            {state.chapters.length === 0 && (
              <div className={styles.statusBanner}>等待 worker 发送首条章节进度…</div>
            )}
            {state.chapters.map((chapter) => (
              <div className={styles.progressItem} key={`${chapter.index}-${chapter.id}`}>
                <span className={styles.dot} data-status={chapter.status} aria-hidden="true" />
                <span>
                  第 {chapter.index + 1} 章 · {chapter.id}
                  {chapter.errorMessage ? `（${chapter.errorMessage}）` : ""}
                </span>
                <span style={{ fontSize: 12, color: "#5a6b71" }}>
                  {chapter.status === "completed"
                    ? "已完成"
                    : chapter.status === "failed"
                      ? "失败"
                      : "排队中"}
                </span>
              </div>
            ))}
          </div>

          {state.status === "done" && (
            <div className={styles.statusBanner} style={{ marginTop: 16 }}>
              生成完成，正在跳转到方案详情…
              <Link
                style={{ marginLeft: 12 }}
                href={`/proposals/${encodeURIComponent(proposalId)}`}
              >
                立即查看
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
