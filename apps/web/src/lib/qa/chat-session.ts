import type { ChatMessage, FeedbackRating, QaReference } from "./types";

export const CHAT_SESSION_STORAGE_KEY = "pas.qa.chat.v1";

interface StoredChat {
  currentSessionId: string | null;
  messages: ChatMessage[];
}

export function serializeChat(chat: StoredChat): string {
  return JSON.stringify(chat);
}

export function parseStoredChat(value: string | null): StoredChat | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;
    if (parsed.currentSessionId !== null && typeof parsed.currentSessionId !== "string") {
      return null;
    }
    if (!Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages.map(parseMessage);
    if (messages.some((message) => message === null)) return null;
    return {
      currentSessionId: parsed.currentSessionId,
      messages: messages as ChatMessage[],
    };
  } catch {
    return null;
  }
}

function parseMessage(value: unknown): ChatMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.role !== "assistant" && value.role !== "user") ||
    typeof value.content !== "string"
  ) {
    return null;
  }
  if (value.messageId !== undefined && typeof value.messageId !== "string") return null;
  if (value.feedback !== undefined && !isFeedbackRating(value.feedback)) return null;
  if (value.refs !== undefined && !isReferences(value.refs)) return null;

  return {
    id: value.id,
    role: value.role,
    content: value.content,
    ...(value.refs === undefined ? {} : { refs: value.refs }),
    ...(value.messageId === undefined ? {} : { messageId: value.messageId }),
    ...(value.feedback === undefined ? {} : { feedback: value.feedback }),
    ...(value.role === "assistant" ? { streaming: false } : {}),
  };
}

function isReferences(value: unknown): value is QaReference[] {
  return (
    Array.isArray(value) &&
    value.every(
      (reference) =>
        isRecord(reference) &&
        typeof reference.n === "number" &&
        typeof reference.docName === "string" &&
        (reference.page === undefined || typeof reference.page === "number"),
    )
  );
}

function isFeedbackRating(value: unknown): value is FeedbackRating {
  return value === "up" || value === "down";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
