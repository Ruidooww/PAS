"use client";

import { useState } from "react";

import type { ChatMessage, FeedbackRating } from "../../lib/qa/types";
import { MarkdownAnswer } from "./markdown-answer";
import { ReferencePanel } from "./reference-panel";
import styles from "./chat.module.css";

interface ChatMessageListProps {
  feedbackPendingMessageId: string | null;
  messages: ChatMessage[];
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
  onSuggestion: (query: string) => void;
}

const suggestions = [
  "控制台加密策略怎么设置？",
  "总结产品部署的前置条件",
  "这套方案支持哪些审计能力？",
];

export function ChatMessageList({
  feedbackPendingMessageId,
  messages,
  onFeedback,
  onSuggestion,
}: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.emptyMark}>P</span>
        <h1>售前知识问答</h1>
        <p>从内部知识库检索依据，并生成带引用的回答。</p>
        <div className={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <ol className={styles.messageList} aria-live="polite">
      {messages.map((message) => (
        <ChatMessageItem
          feedbackPending={feedbackPendingMessageId === message.messageId}
          key={message.id}
          message={message}
          onFeedback={onFeedback}
        />
      ))}
    </ol>
  );
}

function ChatMessageItem({
  feedbackPending,
  message,
  onFeedback,
}: {
  feedbackPending: boolean;
  message: ChatMessage;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}) {
  const [activeReference, setActiveReference] = useState<number | null>(null);
  const refs = message.refs ?? [];
  const sourcePrefix = `qa-source-${message.id}`;

  return (
    <li className={styles.messageRow} data-role={message.role}>
      <div className={styles.avatar} aria-hidden="true">
        {message.role === "assistant" ? "P" : "我"}
      </div>
      <div className={styles.messageBody}>
        <strong>{message.role === "assistant" ? "PAS 助手" : "你"}</strong>
        <div className={styles.messageContent}>
          {message.role === "assistant" ? (
            <MarkdownAnswer
              answer={message.content}
              refs={refs}
              sourcePrefix={sourcePrefix}
              onReferenceSelect={setActiveReference}
            />
          ) : (
            message.content
          )}
          {message.streaming && <span className={styles.cursor} aria-label="正在生成" />}
        </div>
        {message.role === "assistant" && (
          <>
            <ReferencePanel
              activeReference={activeReference}
              refs={refs}
              sourcePrefix={sourcePrefix}
              onSelect={setActiveReference}
            />
            {message.messageId && !message.streaming && (
              <div className={styles.feedback} aria-label="回答反馈">
                <span>这个回答有帮助吗？</span>
                <button
                  aria-label="有帮助"
                  className={message.feedback === "up" ? styles.selectedFeedback : undefined}
                  disabled={feedbackPending}
                  title="有帮助"
                  type="button"
                  onClick={() => onFeedback(message.messageId!, "up")}
                >
                  👍
                </button>
                <button
                  aria-label="没有帮助"
                  className={message.feedback === "down" ? styles.selectedFeedback : undefined}
                  disabled={feedbackPending}
                  title="没有帮助"
                  type="button"
                  onClick={() => onFeedback(message.messageId!, "down")}
                >
                  👎
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}
