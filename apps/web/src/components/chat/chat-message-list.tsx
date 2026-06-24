import type { ChatMessage } from "../../lib/qa/types";
import styles from "./chat.module.css";

interface ChatMessageListProps {
  messages: ChatMessage[];
  onSuggestion: (query: string) => void;
}

const suggestions = [
  "控制台加密策略怎么设置？",
  "总结产品部署的前置条件",
  "这套方案支持哪些审计能力？",
];

export function ChatMessageList({ messages, onSuggestion }: ChatMessageListProps) {
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
        <li className={styles.messageRow} data-role={message.role} key={message.id}>
          <div className={styles.avatar} aria-hidden="true">
            {message.role === "assistant" ? "P" : "我"}
          </div>
          <div className={styles.messageBody}>
            <strong>{message.role === "assistant" ? "PAS 助手" : "你"}</strong>
            <div className={styles.messageContent}>
              {message.content}
              {message.streaming && <span className={styles.cursor} aria-label="正在生成" />}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
