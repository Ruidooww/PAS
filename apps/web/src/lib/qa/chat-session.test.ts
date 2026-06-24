import { describe, expect, it } from "vitest";

import { parseStoredChat, serializeChat } from "./chat-session";

describe("chat session storage", () => {
  it("round-trips the current session and completed messages", () => {
    const value = serializeChat({
      currentSessionId: "session-1",
      messages: [
        { id: "user-1", role: "user", content: "问题" },
        {
          id: "assistant-1",
          role: "assistant",
          content: "回答 [1]",
          messageId: "message-1",
          refs: [{ n: 1, docName: "guide.pdf", page: 2 }],
          feedback: "up",
        },
      ],
    });

    expect(parseStoredChat(value)).toEqual({
      currentSessionId: "session-1",
      messages: [
        { id: "user-1", role: "user", content: "问题" },
        {
          id: "assistant-1",
          role: "assistant",
          content: "回答 [1]",
          messageId: "message-1",
          refs: [{ n: 1, docName: "guide.pdf", page: 2 }],
          feedback: "up",
          streaming: false,
        },
      ],
    });
  });

  it("rejects malformed storage without throwing", () => {
    expect(parseStoredChat("{bad json")).toBeNull();
    expect(parseStoredChat('{"currentSessionId":42,"messages":[]}')).toBeNull();
  });
});
