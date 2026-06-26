"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import {
  ProposalApiError,
  finalizeProposal,
  getProposal,
  listProposalVersions,
  patchProposalSection,
  proposalExportUrl,
} from "../../lib/proposal/api-client";
import type {
  Proposal,
  ProposalSection,
  ProposalVersionRecord,
} from "../../lib/proposal/types";
import styles from "./proposal.module.css";

interface Props {
  proposalId: string;
}

export function ProposalDetailView({ proposalId }: Props) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [versions, setVersions] = useState<ProposalVersionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busySectionId, setBusySectionId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [next, versionList] = await Promise.all([
        getProposal(proposalId),
        listProposalVersions(proposalId),
      ]);
      setProposal(next);
      setVersions(versionList);
      if (!activeSectionId && next.contentJson?.sections.length) {
        setActiveSectionId(next.contentJson.sections[0]!.id);
      }
    } catch (err: unknown) {
      if (err instanceof ProposalApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "无法读取方案");
    }
  }, [activeSectionId, proposalId, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sections: ProposalSection[] = proposal?.contentJson?.sections ?? [];

  async function handleSave(section: ProposalSection) {
    const draftBody = editing[section.id] ?? section.body;
    if (draftBody === section.body) {
      setEditing(({ [section.id]: _removed, ...rest }) => rest);
      return;
    }
    setError(null);
    setBusySectionId(section.id);
    try {
      const next = await patchProposalSection(proposalId, {
        id: section.id,
        body: draftBody,
      });
      setProposal(next);
      setEditing(({ [section.id]: _saved, ...rest }) => rest);
      setVersions(await listProposalVersions(proposalId));
    } catch (err: unknown) {
      if (err instanceof ProposalApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "保存失败，请稍后重试");
    } finally {
      setBusySectionId(null);
    }
  }

  async function handleFinalize() {
    if (!proposal) return;
    if (proposal.status === "final") return;
    setError(null);
    setFinalizing(true);
    try {
      const next = await finalizeProposal(proposalId);
      setProposal(next);
      setVersions(await listProposalVersions(proposalId));
    } catch (err: unknown) {
      if (err instanceof ProposalApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "定稿失败，请稍后重试");
    } finally {
      setFinalizing(false);
    }
  }

  const exportHrefs = useMemo(
    () => ({
      docx: proposalExportUrl(proposalId, "docx"),
      md: proposalExportUrl(proposalId, "md"),
    }),
    [proposalId],
  );

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <strong>PAS</strong>
            <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
              方案详情
            </span>
          </div>
        </div>
        <div>
          <Link href="/proposals/new">新建方案</Link>
        </div>
      </header>

      <main className={styles.content}>
        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}
        {!proposal && !error && (
          <div className={styles.statusBanner}>加载方案中…</div>
        )}
        {proposal && (
          <div className={styles.detailLayout}>
            <aside className={styles.sidebar}>
              <h3>章节目录</h3>
              <ul className={styles.tocList}>
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      aria-current={activeSectionId === section.id}
                      onClick={() => {
                        setActiveSectionId(section.id);
                        document
                          .getElementById(`section-${section.id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section>
              <div className={styles.card} style={{ marginBottom: 16 }}>
                <h2>
                  {proposal.title}
                  <span className={styles.statusPill} data-status={proposal.status}>
                    {proposal.status} · v{proposal.version}
                  </span>
                </h2>
                <p className={styles.hint}>
                  客户：{proposal.customerRef} ｜ 创建：
                  {new Date(proposal.createdAt).toLocaleString("zh-CN")}
                </p>
                <div className={styles.actions} style={{ justifyContent: "flex-start" }}>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleFinalize}
                    disabled={proposal.status === "final" || finalizing}
                  >
                    {proposal.status === "final"
                      ? "已定稿"
                      : finalizing
                        ? "定稿中…"
                        : "定稿"}
                  </button>
                  <div className={styles.exportRow}>
                    <a href={exportHrefs.docx}>下载 Word</a>
                    <a href={exportHrefs.md}>下载 Markdown</a>
                  </div>
                </div>
              </div>

              {sections.map((section) => {
                const draft = editing[section.id];
                const isEditing = draft !== undefined;
                const busy = busySectionId === section.id;
                return (
                  <article
                    className={styles.sectionCard}
                    id={`section-${section.id}`}
                    key={section.id}
                  >
                    <h2>
                      {section.title}
                      <span style={{ display: "flex", gap: 8 }}>
                        {isEditing ? (
                          <>
                            <button
                              className={styles.secondary}
                              type="button"
                              onClick={() =>
                                setEditing(({ [section.id]: _cancel, ...rest }) => rest)
                              }
                              disabled={busy}
                            >
                              取消
                            </button>
                            <button
                              className={styles.primary}
                              type="button"
                              onClick={() => handleSave(section)}
                              disabled={busy}
                            >
                              {busy ? "保存中…" : "保存"}
                            </button>
                          </>
                        ) : (
                          <button
                            className={styles.secondary}
                            type="button"
                            onClick={() =>
                              setEditing((current) => ({
                                ...current,
                                [section.id]: section.body,
                              }))
                            }
                          >
                            编辑
                          </button>
                        )}
                      </span>
                    </h2>

                    {isEditing ? (
                      <textarea
                        className={styles.editor}
                        value={draft}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [section.id]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <div className={styles.markdownPreview}>
                        <ReactMarkdown
                          rehypePlugins={[rehypeSanitize]}
                          remarkPlugins={[remarkGfm]}
                        >
                          {section.body || "_本章节正文为空_"}
                        </ReactMarkdown>
                      </div>
                    )}

                    {section.refs.length > 0 && (
                      <div className={styles.refList}>
                        <strong>引用</strong>
                        <ol>
                          {[...section.refs]
                            .sort((left, right) => left.n - right.n)
                            .map((ref) => (
                              <li key={ref.n}>
                                {`[${ref.n}] ${ref.docName || "未命名来源"}`}
                                {ref.page !== undefined ? `, page ${ref.page}` : ""}
                              </li>
                            ))}
                        </ol>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <aside className={styles.sidebar}>
              <h3>版本历史</h3>
              {versions.length === 0 ? (
                <p style={{ fontSize: 13, color: "#5a6b71" }}>
                  尚未定稿，定稿后会在此显示历史快照。
                </p>
              ) : (
                <ul className={styles.versionList}>
                  {versions.map((version) => (
                    <li key={version.id}>
                      <strong>v{version.version}</strong>
                      <div style={{ color: "#5a6b71" }}>
                        {new Date(version.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
