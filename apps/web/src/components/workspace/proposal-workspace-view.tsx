"use client";

import React, { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { CrmApiError, getCustomer, listOpportunities } from "../../lib/crm/api-client";
import type { CustomerDetail, OpportunitySummary } from "../../lib/crm/types";
import {
  ProposalApiError,
  getProposal,
  listProposalVersions,
  patchProposalSection,
} from "../../lib/proposal/api-client";
import type {
  Proposal,
  ProposalSection,
  ProposalVersionRecord,
} from "../../lib/proposal/types";
import { chatReducer, initialChatState } from "../../lib/qa/chat-reducer";
import { qaErrorMessage } from "../../lib/qa/error-message";
import { QaHttpError, streamQa } from "../../lib/qa/sse-client";
import type { QaStreamEvent } from "../../lib/qa/types";
import { AppShell } from "../shell/app-shell";
import styles from "./proposal-workspace.module.css";

interface ProposalWorkspaceViewProps {
  proposalId: string;
}

export function ProposalWorkspaceView({ proposalId }: ProposalWorkspaceViewProps) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [versions, setVersions] = useState<ProposalVersionRecord[]>([]);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProposal, nextVersions] = await Promise.all([
        getProposal(proposalId),
        listProposalVersions(proposalId),
      ]);
      setProposal(nextProposal);
      setVersions(nextVersions);
      setActiveSectionId((current) => {
        const sections = nextProposal.contentJson?.sections ?? [];
        if (current && sections.some((section) => section.id === current)) return current;
        return sections[0]?.id ?? null;
      });

      const [nextCustomer, nextOpportunities] = await Promise.all([
        getCustomer(nextProposal.customerRef).catch((err: unknown) => {
          if (err instanceof CrmApiError && err.status === 404) return null;
          throw err;
        }),
        listOpportunities({ customerRef: nextProposal.customerRef }).then((res) => res.items),
      ]);
      setCustomer(nextCustomer);
      setOpportunities(nextOpportunities);
    } catch (err: unknown) {
      if (
        (err instanceof ProposalApiError || err instanceof CrmApiError) &&
        err.status === 401
      ) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "无法加载方案工作台");
    } finally {
      setLoading(false);
    }
  }, [proposalId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageTitle = proposal?.title ?? "方案工作室";

  async function handleSaveSection(section: ProposalSection) {
    const nextBody = editing[section.id] ?? section.body;
    if (nextBody === section.body) {
      setEditing(({ [section.id]: _removed, ...rest }) => rest);
      return;
    }

    setError(null);
    setSavingSectionId(section.id);
    try {
      const nextProposal = await patchProposalSection(proposalId, {
        id: section.id,
        body: nextBody,
      });
      setProposal(nextProposal);
      setVersions(await listProposalVersions(proposalId));
      setEditing(({ [section.id]: _saved, ...rest }) => rest);
    } catch (err: unknown) {
      if (err instanceof ProposalApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "保存章节失败");
    } finally {
      setSavingSectionId(null);
    }
  }

  return (
    <AppShell
      pageTitle={pageTitle}
      pageDescription={proposal ? `客户 ${proposal.customerRef} · v${proposal.version}` : "加载方案上下文、正文和 AI 助手"}
      breadcrumb={[
        { label: "方案", href: "/proposals" },
        { label: proposal?.title ?? proposalId, href: `/proposals/${encodeURIComponent(proposalId)}` },
        { label: "工作台" },
      ]}
      actions={
        <Link href={`/proposals/${encodeURIComponent(proposalId)}`}>
          返回详情
        </Link>
      }
    >
      {loading && <div className={styles.statePanel}>正在加载方案工作台...</div>}
      {error && (
        <div className={styles.errorPanel} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
      {proposal && (
        <ProposalWorkspaceContent
          activeSectionId={activeSectionId}
          assistant={<WorkspaceAssistant proposal={proposal} />}
          customer={customer}
          editing={editing}
          onActiveSectionChange={setActiveSectionId}
          onCancelEdit={(sectionId) =>
            setEditing(({ [sectionId]: _removed, ...rest }) => rest)
          }
          onDraftChange={(sectionId, body) =>
            setEditing((current) => ({ ...current, [sectionId]: body }))
          }
          onSaveSection={handleSaveSection}
          opportunities={opportunities}
          proposal={proposal}
          savingSectionId={savingSectionId}
          versions={versions}
        />
      )}
    </AppShell>
  );
}

interface ProposalWorkspaceContentProps {
  activeSectionId: string | null;
  assistant: ReactNode;
  customer: CustomerDetail | null;
  editing: Record<string, string>;
  onActiveSectionChange: (sectionId: string) => void;
  onCancelEdit: (sectionId: string) => void;
  onDraftChange: (sectionId: string, body: string) => void;
  onSaveSection: (section: ProposalSection) => void;
  opportunities: OpportunitySummary[];
  proposal: Proposal;
  savingSectionId: string | null;
  versions: ProposalVersionRecord[];
}

export function ProposalWorkspaceContent({
  activeSectionId,
  assistant,
  customer,
  editing,
  onActiveSectionChange,
  onCancelEdit,
  onDraftChange,
  onSaveSection,
  opportunities,
  proposal,
  savingSectionId,
  versions,
}: ProposalWorkspaceContentProps) {
  const sections = proposal.contentJson?.sections ?? [];
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null;
  const activeBody = activeSection ? (editing[activeSection.id] ?? activeSection.body) : "";
  const activeRefs = activeSection?.refs ?? [];
  const primaryOpportunity = opportunities[0] ?? null;

  return (
    <div className={styles.workspace}>
      <aside className={styles.contextColumn} data-workspace-column="context">
        <Panel title="客户摘要">
          <div className={styles.customerCard}>
            <div>
              <strong>{customer?.name ?? proposal.requirementJson.customer ?? proposal.customerRef}</strong>
              <span>{customer?.industry ?? proposal.requirementJson.industry}</span>
            </div>
            <span className={styles.badge}>{customer?.source ?? "proposal"}</span>
          </div>
          <dl className={styles.fieldGrid}>
            <dt>规模</dt>
            <dd>{formatScale(customer?.scale, proposal.requirementJson.scale)}</dd>
            <dt>负责人</dt>
            <dd>{customer?.ownerId ?? primaryOpportunity?.ownerId ?? "未分配"}</dd>
            <dt>状态</dt>
            <dd>{proposal.status}</dd>
          </dl>
        </Panel>

        <Panel title="商机 / 版本时间线">
          <ol className={styles.timeline}>
            <li className={styles.current}>
              <span />
              <div>
                <strong>{primaryOpportunity?.stage ?? "方案设计"}</strong>
                <small>{primaryOpportunity?.title ?? proposal.title}</small>
              </div>
            </li>
            {versions.slice(0, 4).map((version) => (
              <li key={version.id}>
                <span />
                <div>
                  <strong>v{version.version}</strong>
                  <small>{formatDate(version.createdAt)}</small>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="文档锚点">
          <nav className={styles.anchorList} aria-label="章节目录">
            {sections.map((section, index) => (
              <button
                aria-current={activeSection?.id === section.id ? "page" : undefined}
                data-section-anchor={section.id}
                key={section.id}
                onClick={() => onActiveSectionChange(section.id)}
                type="button"
              >
                <span>{index + 1}</span>
                {section.title}
              </button>
            ))}
          </nav>
        </Panel>
      </aside>

      <section className={styles.editorColumn} data-workspace-column="editor">
        <div className={styles.editorHeader}>
          <div>
            <h2>方案正文</h2>
            <span>Markdown 编辑 · 当前章节 {activeSection ? activeSection.title : "暂无章节"}</span>
          </div>
          <div className={styles.editorMeta}>
            <span className={styles.saveDot} />
            字数：{activeBody.length.toLocaleString("zh-CN")}
          </div>
        </div>

        <div className={styles.sectionTabs}>
          {sections.map((section) => (
            <button
              aria-current={activeSection?.id === section.id ? "page" : undefined}
              data-section-tab={section.id}
              key={section.id}
              onClick={() => onActiveSectionChange(section.id)}
              type="button"
            >
              {section.title}
            </button>
          ))}
        </div>

        {activeSection ? (
          <article className={styles.documentEditor}>
            <div className={styles.documentActions}>
              <strong>{activeSection.title}</strong>
              <span>
                <button
                  disabled={savingSectionId === activeSection.id}
                  onClick={() => onCancelEdit(activeSection.id)}
                  type="button"
                >
                  取消
                </button>
                <button
                  disabled={savingSectionId === activeSection.id}
                  onClick={() => onSaveSection(activeSection)}
                  type="button"
                >
                  {savingSectionId === activeSection.id ? "保存中" : "保存章节"}
                </button>
              </span>
            </div>
            <textarea
              aria-label={`${activeSection.title} Markdown`}
              className={styles.markdownEditor}
              onChange={(event) => onDraftChange(activeSection.id, event.target.value)}
              value={activeBody}
            />
            <div className={styles.markdownPreview}>
              <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
                {activeBody || "_当前章节暂无正文_"}
              </ReactMarkdown>
            </div>
          </article>
        ) : (
          <div className={styles.statePanel}>当前方案还没有正文章节。</div>
        )}
      </section>

      <aside className={styles.assistantColumn} data-workspace-column="assistant">
        <section className={styles.assistantPanel}>
          <div className={styles.panelHeader}>
            <h2>AI 助手</h2>
            <span>{proposal.title}</span>
          </div>
          {assistant}
        </section>

        <section className={styles.referencesPanel}>
          <div className={styles.panelHeader}>
            <h2>RAG 引用</h2>
            <span>{activeRefs.length} 条</span>
          </div>
          {activeRefs.length === 0 ? (
            <p className={styles.emptyText}>当前章节暂无引用。</p>
          ) : (
            <ol className={styles.referenceList}>
              {[...activeRefs]
                .sort((left, right) => left.n - right.n)
                .map((ref) => (
                  <li key={`${ref.n}-${ref.docName}`}>
                    <button type="button">
                      <span>{ref.n}</span>
                      <strong>{ref.docName || "未命名来源"}</strong>
                      {ref.page !== undefined && <small>page {ref.page}</small>}
                    </button>
                  </li>
                ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}

function WorkspaceAssistant({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const abortController = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = transcript.current;
    if (!container || state.messages.length === 0) return;
    const frame = requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.messages]);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  async function ask(query: string) {
    if (state.status === "streaming") return;
    const controller = new AbortController();
    abortController.current = controller;
    dispatch({
      type: "start",
      query,
      userMessageId: crypto.randomUUID(),
      assistantMessageId: crypto.randomUUID(),
    });
    try {
      await streamQa(
        {
          query: `围绕方案《${proposal.title}》回答：${query}`,
          sessionId: state.currentSessionId ?? undefined,
        },
        handleEvent,
        { signal: controller.signal },
      );
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof QaHttpError && err.status === 401) {
        router.replace("/login");
        return;
      }
      dispatch({ type: "error", message: qaErrorMessage(err) });
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  }

  function handleEvent(event: QaStreamEvent) {
    dispatch(event);
  }

  return (
    <div className={styles.assistantBody}>
      <div className={styles.chatTranscript} ref={transcript}>
        {state.messages.length === 0 ? (
          <div className={styles.assistantEmpty}>
            <strong>从当前方案继续追问</strong>
            <button type="button" onClick={() => void ask("补充总体架构和技术路线")}>
              补充总体架构
            </button>
            <button type="button" onClick={() => void ask("列出本方案的主要风险与缓解措施")}>
              梳理风险措施
            </button>
          </div>
        ) : (
          <ol className={styles.chatMessages} aria-live="polite">
            {state.messages.map((message) => (
              <li data-role={message.role} key={message.id}>
                <strong>{message.role === "assistant" ? "AI 助手" : "我"}</strong>
                <div>{message.content || (message.streaming ? "生成中..." : "")}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {state.error && (
        <div className={styles.chatError} role="alert">
          <span>{state.error}</span>
          <button type="button" onClick={() => dispatch({ type: "clearError" })}>
            关闭
          </button>
        </div>
      )}
      <MiniComposer disabled={state.status === "streaming"} onSubmit={ask} />
    </div>
  );
}

function MiniComposer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (query: string) => void;
}) {
  const [query, setQuery] = useState("");

  function submit() {
    const trimmed = query.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setQuery("");
  }

  return (
    <form
      className={styles.miniComposer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label="询问方案知识库内容"
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
        placeholder="询问方案或知识库内容..."
        rows={2}
        value={query}
      />
      <button disabled={disabled || !query.trim()} type="submit">
        发送
      </button>
    </form>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.contextPanel}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function formatScale(scale?: number | null, fallback?: string): string {
  if (typeof scale === "number") return `${scale.toLocaleString("zh-CN")} 人`;
  return fallback || "未填写";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
