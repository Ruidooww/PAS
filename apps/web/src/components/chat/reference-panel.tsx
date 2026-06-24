import type { QaReference } from "../../lib/qa/types";
import styles from "./chat.module.css";

interface ReferencePanelProps {
  activeReference: number | null;
  refs: QaReference[];
  sourcePrefix: string;
  onSelect: (referenceNumber: number) => void;
}

export function ReferencePanel({
  activeReference,
  refs,
  sourcePrefix,
  onSelect,
}: ReferencePanelProps) {
  if (refs.length === 0) return null;

  return (
    <section className={styles.referencePanel} aria-label="回答引用来源">
      <h2>引用来源</h2>
      <ol>
        {refs.map((reference) => (
          <li
            className={activeReference === reference.n ? styles.activeReference : undefined}
            id={`${sourcePrefix}-${reference.n}`}
            key={`${reference.n}-${reference.docName}`}
          >
            <button type="button" onClick={() => onSelect(reference.n)}>
              <span>[{reference.n}]</span>
              <strong>{reference.docName}</strong>
              {reference.page !== undefined && <small>第 {reference.page} 页</small>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
