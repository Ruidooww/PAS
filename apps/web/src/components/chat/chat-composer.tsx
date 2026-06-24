"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

import styles from "./chat.module.css";

interface ChatComposerProps {
  disabled: boolean;
  onSubmit: (query: string) => void;
}

export function ChatComposer({ disabled, onSubmit }: ChatComposerProps) {
  const [query, setQuery] = useState("");

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setQuery("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      <label className={styles.srOnly} htmlFor="qa-query">
        输入问题
      </label>
      <textarea
        id="qa-query"
        value={query}
        disabled={disabled}
        rows={1}
        placeholder="输入售前问题"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" disabled={disabled || !query.trim()}>
        发送
      </button>
    </form>
  );
}
