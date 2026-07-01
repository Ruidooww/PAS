"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppShell } from "../shell/app-shell";
import {
  CrmApiError,
  createOpportunity,
  listCustomers,
} from "../../lib/crm/api-client";
import type { CustomerSummary, OpportunityStage } from "../../lib/crm/types";
import styles from "./crm.module.css";

const STAGE_OPTIONS: Array<{ value: OpportunityStage; label: string }> = [
  { value: "discovery", label: "需求发现" },
  { value: "qualified", label: "已确认" },
  { value: "evaluation", label: "评估中" },
  { value: "negotiation", label: "商务谈判" },
  { value: "closed_won", label: "已赢单" },
  { value: "closed_lost", label: "已丢单" },
];

export function OpportunityNewForm() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [customerRef, setCustomerRef] = useState("");
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<OpportunityStage>("discovery");
  const [amountEstimate, setAmountEstimate] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listCustomers({ page: 1 })
      .then((res) => {
        if (!active) return;
        setCustomers(res.items);
        setCustomerRef((current) => current || res.items[0]?.ref || "");
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof CrmApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "客户列表加载失败");
      })
      .finally(() => {
        if (active) setLoadingCustomers(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const canSubmit = useMemo(
    () => Boolean(customerRef && title.trim() && !submitting),
    [customerRef, submitting, title],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const amount = amountEstimate.trim() ? Number(amountEstimate) : null;
      const created = await createOpportunity({
        customerRef,
        title: title.trim(),
        stage,
        amountEstimate: amount,
      });
      router.push(`/opportunities/${encodeURIComponent(created.ref)}`);
    } catch (err) {
      if (err instanceof CrmApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "商机创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      pageTitle="新建商机"
      pageDescription="录入演示 CRM 商机，创建后进入商机详情。"
      breadcrumb={[
        { label: "商机", href: "/opportunities" },
        { label: "新建商机" },
      ]}
      actions={
        <Link href="/opportunities" className={styles.filterPill} style={{ textDecoration: "none" }}>
          返回列表
        </Link>
      }
    >
      {error && <div className={styles.errorBanner}>{error}</div>}
      <form className={styles.formCard} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span>客户</span>
          <select
            className={styles.select}
            value={customerRef}
            disabled={loadingCustomers || customers.length === 0}
            onChange={(event) => setCustomerRef(event.target.value)}
          >
            {customers.map((customer) => (
              <option key={customer.ref} value={customer.ref}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>商机标题</span>
          <input
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：长江精密 IP-Guard 扩容"
          />
        </label>

        <label className={styles.field}>
          <span>阶段</span>
          <select
            className={styles.select}
            value={stage}
            onChange={(event) => setStage(event.target.value as OpportunityStage)}
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>金额</span>
          <input
            className={styles.input}
            inputMode="numeric"
            min="0"
            type="number"
            value={amountEstimate}
            onChange={(event) => setAmountEstimate(event.target.value)}
            placeholder="可留空"
          />
        </label>

        <div className={styles.formActions}>
          <button className={styles.primaryButton} disabled={!canSubmit} type="submit">
            {submitting ? "创建中..." : "创建商机"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
