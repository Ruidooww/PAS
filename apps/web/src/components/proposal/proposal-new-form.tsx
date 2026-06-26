"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ProposalApiError,
  createProposalDraft,
  enqueueProposalGeneration,
  listProposalTemplates,
} from "../../lib/proposal/api-client";
import type {
  DraftRequirementForm,
  ProposalTemplateSummary,
} from "../../lib/proposal/types";
import { AppShell } from "../shell/app-shell";
import styles from "./proposal.module.css";

const DEFAULT_INDUSTRIES = ["制造业", "金融业", "互联网", "政府/事业单位", "教育", "其他"];
const DEFAULT_NEEDS = [
  "终端文档加密",
  "外发管控",
  "上网行为审计",
  "数据资产分类分级",
  "终端违规外联监控",
  "屏幕水印 / 行为审计",
];

interface FormState extends DraftRequirementForm {
  freeText: string;
  templateId: string;
}

const INITIAL_FORM: FormState = {
  customerName: "",
  industry: DEFAULT_INDUSTRIES[0]!,
  scale: "",
  needs: [],
  constraints: [],
  freeText: "",
  templateId: "",
};

export function ProposalNewForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [templates, setTemplates] = useState<ProposalTemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constraintText, setConstraintText] = useState("");

  useEffect(() => {
    let active = true;
    listProposalTemplates()
      .then((list) => {
        if (!active) return;
        setTemplates(list);
        setForm((current) =>
          current.templateId.length > 0
            ? current
            : { ...current, templateId: list[0]?.id ?? "" },
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ProposalApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError("无法加载方案模板，请稍后重试");
      })
      .finally(() => {
        if (active) setLoadingTemplates(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  function toggleNeed(need: string) {
    setForm((current) =>
      current.needs.includes(need)
        ? { ...current, needs: current.needs.filter((value) => value !== need) }
        : { ...current, needs: [...current.needs, need] },
    );
  }

  function constraintsFromText(text: string): string[] {
    return text
      .split(/[\r\n;,；,]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!form.templateId) {
      setError("请选择方案模板");
      return;
    }
    if (!form.customerName.trim()) {
      setError("请填写客户名称");
      return;
    }
    if (!form.scale.trim()) {
      setError("请填写客户规模");
      return;
    }
    if (form.needs.length === 0 && form.freeText.trim().length === 0) {
      setError("请至少勾选一个需求，或填写自由文本辅助补全");
      return;
    }

    setSubmitting(true);
    try {
      const draft = await createProposalDraft({
        freeText: form.freeText.trim() || undefined,
        formFields: {
          customerName: form.customerName.trim(),
          industry: form.industry.trim(),
          scale: form.scale.trim(),
          needs: form.needs,
          constraints: constraintsFromText(constraintText),
        },
      });
      await enqueueProposalGeneration(draft.id, form.templateId);
      router.replace(`/proposals/${encodeURIComponent(draft.id)}/generating`);
    } catch (err: unknown) {
      if (err instanceof ProposalApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      const message =
        err instanceof Error ? err.message : "提交失败，请稍后重试";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      pageTitle="新建方案"
      pageDescription="填写客户需求并选择模板，提交后将自动开始生成。需求字段不齐可在 freeText 辅助补全里粘贴会议记录或调研笔记。"
      breadcrumb={[{ label: "方案", href: "/proposals" }, { label: "新建方案" }]}
      actions={
        <Link href="/qa" className={styles.shellLinkBtn}>
          返回问答
        </Link>
      }
    >
      <section className={styles.card}>
          {error && (
            <div className={styles.errorBanner} role="alert">
              {error}
            </div>
          )}
          <form className={styles.formGrid} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="template">方案模板</label>
              <select
                id="template"
                disabled={loadingTemplates || submitting}
                value={form.templateId}
                onChange={(event) =>
                  setForm({ ...form, templateId: event.target.value })
                }
              >
                {loadingTemplates && <option value="">加载中…</option>}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · v{template.version} ({template.sections.length} 章)
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="customerName">客户名称</label>
              <input
                id="customerName"
                value={form.customerName}
                onChange={(event) =>
                  setForm({ ...form, customerName: event.target.value })
                }
                placeholder="如 华义匀安"
                required
                disabled={submitting}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="industry">行业</label>
              <select
                id="industry"
                value={form.industry}
                onChange={(event) =>
                  setForm({ ...form, industry: event.target.value })
                }
                disabled={submitting}
              >
                {DEFAULT_INDUSTRIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="scale">规模</label>
              <input
                id="scale"
                value={form.scale}
                onChange={(event) =>
                  setForm({ ...form, scale: event.target.value })
                }
                placeholder="如 500 人 / 1000 终端"
                disabled={submitting}
              />
            </div>

            <div className={styles.field}>
              <label>核心需求（可多选）</label>
              <div className={styles.checklist}>
                {DEFAULT_NEEDS.map((need) => (
                  <label key={need}>
                    <input
                      type="checkbox"
                      checked={form.needs.includes(need)}
                      onChange={() => toggleNeed(need)}
                      disabled={submitting}
                    />
                    {need}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="constraints">特殊约束（每行一条）</label>
              <textarea
                id="constraints"
                value={constraintText}
                onChange={(event) => setConstraintText(event.target.value)}
                placeholder="如 私有化部署、合规要求、预算上限…"
                disabled={submitting}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="freeText">freeText 辅助补全（可选）</label>
              <textarea
                id="freeText"
                value={form.freeText}
                onChange={(event) => setForm({ ...form, freeText: event.target.value })}
                placeholder="粘贴客户访谈、会议记录或调研笔记，由 LLM 自动补齐 needs / constraints"
                disabled={submitting}
              />
            </div>

            <div className={styles.actions}>
              <Link className={styles.secondary} href="/qa">
                取消
              </Link>
              <button
                className={styles.primary}
                type="submit"
                disabled={submitting || loadingTemplates}
              >
                {submitting ? "提交中…" : "提交并开始生成"}
              </button>
            </div>
          </form>
        </section>
    </AppShell>
  );
}
