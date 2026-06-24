"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { chatReducer, initialChatState } from "../../lib/qa/chat-reducer";
import {
  CHAT_SESSION_STORAGE_KEY,
  parseStoredChat,
  serializeChat,
} from "../../lib/qa/chat-session";
import { submitQaFeedback } from "../../lib/qa/feedback-client";
import { QaHttpError, streamQa } from "../../lib/qa/sse-client";
import type { FeedbackRating, QaStreamEvent } from "../../lib/qa/types";
import { ChatComposer } from "./chat-composer";
import { ChatMessageList } from "./chat-message-list";
import styles from "./chat.module.css";

interface CurrentUser {
  name?: string;
  role?: string;
}

export function ChatWorkspace() {
  const router = useRouter();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authPending, setAuthPending] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [feedbackPendingMessageId, setFeedbackPendingMessageId] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = parseStoredChat(sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY));
    if (stored) {
      dispatch({
        type: "restore",
        sessionId: stored.currentSessionId,
        messages: stored.messages,
      });
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || state.status === "streaming") return;
    if (!state.currentSessionId && state.messages.length === 0) {
      sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      serializeChat({
        currentSessionId: state.currentSessionId,
        messages: state.messages,
      }),
    );
  }, [state.currentSessionId, state.messages, state.status, storageReady]);

  useEffect(() => {
    let active = true;
    void fetch("/api/me", { credentials: "include" }).then(async (response) => {
      if (!active) return;
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        dispatch({ type: "error", message: "无法验证登录状态，请稍后重试。" });
        setAuthPending(false);
        return;
      }
      setUser((await response.json()) as CurrentUser);
      setAuthPending(false);
    });
    return () => {
      active = false;
      abortController.current?.abort();
    };
  }, [router]);

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
          query,
          sessionId: state.currentSessionId ?? undefined,
        },
        handleEvent,
        { signal: controller.signal },
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof QaHttpError && error.status === 401) {
        router.replace("/login");
        return;
      }
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "问答请求失败，请稍后重试。",
      });
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  }

  async function sendFeedback(messageId: string, rating: FeedbackRating) {
    setFeedbackPendingMessageId(messageId);
    try {
      await submitQaFeedback(messageId, rating);
      dispatch({ type: "feedback", messageId, rating });
    } catch (error) {
      if (error instanceof QaHttpError && error.status === 401) {
        router.replace("/login");
        return;
      }
      dispatch({ type: "error", message: "反馈提交失败，请稍后重试。" });
    } finally {
      setFeedbackPendingMessageId(null);
    }
  }

  function startNewConversation() {
    abortController.current?.abort();
    abortController.current = null;
    sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    dispatch({ type: "reset" });
  }

  function handleEvent(event: QaStreamEvent) {
    switch (event.type) {
      case "session":
        dispatch(event);
        break;
      case "delta":
        dispatch(event);
        break;
      case "refs":
        dispatch(event);
        break;
      case "message":
        dispatch(event);
        break;
      case "done":
        dispatch(event);
        break;
    }
  }

  if (authPending) {
    return (
      <main className={styles.authPending}>
        <span>正在载入售前工作台</span>
      </main>
    );
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div>
            <strong>PAS</strong>
            <span>售前知识问答</span>
          </div>
        </div>
        <div className={styles.user}>
          <div>
            <strong>{user?.name ?? "售前用户"}</strong>
            <span>{user?.role ?? "presales"}</span>
          </div>
          <button type="button" onClick={startNewConversation}>
            新建对话
          </button>
        </div>
      </header>

      <section className={styles.chat}>
        <div className={styles.transcript}>
          <ChatMessageList
            feedbackPendingMessageId={feedbackPendingMessageId}
            messages={state.messages}
            onFeedback={sendFeedback}
            onSuggestion={ask}
          />
        </div>
        <div className={styles.composerBar}>
          <ChatComposer disabled={state.status === "streaming"} onSubmit={ask} />
        </div>
      </section>
    </main>
  );
}
