"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { linkAnswerCitations } from "../../lib/qa/citation-links";
import type { QaReference } from "../../lib/qa/types";
import styles from "./chat.module.css";

interface MarkdownAnswerProps {
  answer: string;
  refs: QaReference[];
  sourcePrefix: string;
  onReferenceSelect: (referenceNumber: number) => void;
}

export function MarkdownAnswer({
  answer,
  refs,
  sourcePrefix,
  onReferenceSelect,
}: MarkdownAnswerProps) {
  const markdown = linkAnswerCitations(
    answer,
    refs.map((reference) => reference.n),
    sourcePrefix,
  );
  const sourceHrefPrefix = `#${sourcePrefix}-`;

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            if (href?.startsWith(sourceHrefPrefix)) {
              const referenceNumber = Number(href.slice(sourceHrefPrefix.length));
              return (
                <a
                  {...props}
                  className={styles.citation}
                  href={href}
                  onClick={() => onReferenceSelect(referenceNumber)}
                >
                  {children}
                </a>
              );
            }
            return (
              <a {...props} href={href} rel="noreferrer" target="_blank">
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
