import type { ChatMessage, QaReference } from "./types";

export interface ChatState {
  messages: ChatMessage[];
  currentSessionId: string | null;
  status: "error" | "idle" | "streaming";
  error: string | null;
}

export type ChatAction =
  | {
      type: "start";
      query: string;
      userMessageId: string;
      assistantMessageId: string;
    }
  | { type: "session"; sessionId: string }
  | { type: "delta"; content: string }
  | { type: "refs"; refs: QaReference[] }
  | { type: "message"; messageId: string }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "reset" };

export const initialChatState: ChatState = {
  messages: [],
  currentSessionId: null,
  status: "idle",
  error: null,
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "start":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.userMessageId, role: "user", content: action.query },
          {
            id: action.assistantMessageId,
            role: "assistant",
            content: "",
            streaming: true,
          },
        ],
        status: "streaming",
        error: null,
      };
    case "session":
      return { ...state, currentSessionId: action.sessionId };
    case "delta":
      return updateStreamingMessage(state, (message) => ({
        ...message,
        content: message.content + action.content,
      }));
    case "refs":
      return updateStreamingMessage(state, (message) => ({
        ...message,
        refs: action.refs,
      }));
    case "message":
      return updateStreamingMessage(state, (message) => ({
        ...message,
        messageId: action.messageId,
      }));
    case "done":
      return {
        ...updateStreamingMessage(state, (message) => ({
          ...message,
          streaming: false,
        })),
        status: "idle",
      };
    case "error":
      return {
        ...updateStreamingMessage(state, (message) => ({
          ...message,
          streaming: false,
        })),
        status: "error",
        error: action.message,
      };
    case "reset":
      return initialChatState;
  }
}

function updateStreamingMessage(
  state: ChatState,
  update: (message: ChatMessage) => ChatMessage,
): ChatState {
  const index = state.messages.findLastIndex(
    (message) => message.role === "assistant" && message.streaming,
  );
  if (index === -1) return state;
  return {
    ...state,
    messages: state.messages.map((message, messageIndex) =>
      messageIndex === index ? update(message) : message,
    ),
  };
}
