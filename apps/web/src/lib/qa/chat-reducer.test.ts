import { describe, expect, it } from "vitest";

import {
  chatReducer,
  initialChatState,
  type ChatState,
} from "./chat-reducer";

function streamingState(): ChatState {
  return chatReducer(initialChatState, {
    type: "start",
    query: "如何配置控制台加密策略？",
    userMessageId: "user-1",
    assistantMessageId: "assistant-1",
  });
}

describe("chatReducer", () => {
  it("starts a turn and appends streamed events to the pending assistant message", () => {
    let state = streamingState();

    state = chatReducer(state, { type: "session", sessionId: "session-1" });
    state = chatReducer(state, { type: "delta", content: "先进入策略中心" });
    state = chatReducer(state, { type: "delta", content: "，再新建策略 [1]" });
    state = chatReducer(state, {
      type: "refs",
      refs: [{ n: 1, docName: "Web 控制台说明.pdf", page: 24 }],
    });
    state = chatReducer(state, { type: "message", messageId: "message-1" });
    state = chatReducer(state, { type: "done" });

    expect(state.currentSessionId).toBe("session-1");
    expect(state.status).toBe("idle");
    expect(state.messages).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "如何配置控制台加密策略？",
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "先进入策略中心，再新建策略 [1]",
        refs: [{ n: 1, docName: "Web 控制台说明.pdf", page: 24 }],
        messageId: "message-1",
        streaming: false,
      },
    ]);
  });

  it("keeps completed messages and exposes a retryable error", () => {
    let state = streamingState();
    state = chatReducer(state, { type: "delta", content: "partial answer" });
    state = chatReducer(state, { type: "error", message: "连接已中断" });

    expect(state.status).toBe("error");
    expect(state.error).toBe("连接已中断");
    expect(state.messages.at(-1)).toMatchObject({
      content: "partial answer",
      streaming: false,
    });
  });
});
