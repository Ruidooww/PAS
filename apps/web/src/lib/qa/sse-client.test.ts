import { describe, expect, it, vi } from "vitest";

import { streamQa } from "./sse-client";
import type { QaStreamEvent } from "./types";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

describe("streamQa", () => {
  it("parses all five QA event types across arbitrary response chunks", async () => {
    const events: QaStreamEvent[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"type":"session","sessionId":"session-1"}\n\n',
        'data: {"type":"delta","content":"先进入',
        '策略中心"}\n\ndata: {"type":"refs","refs":[{"n":1,"docName":"guide.pdf","page":24}]}\n\n',
        'data: {"type":"message","messageId":"message-1"}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    );

    await streamQa(
      { query: "如何配置？", sessionId: "session-old" },
      (event) => events.push(event),
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/internal/qa",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ query: "如何配置？", sessionId: "session-old" }),
      }),
    );
    expect(events).toEqual([
      { type: "session", sessionId: "session-1" },
      { type: "delta", content: "先进入策略中心" },
      { type: "refs", refs: [{ n: 1, docName: "guide.pdf", page: 24 }] },
      { type: "message", messageId: "message-1" },
      { type: "done" },
    ]);
  });

  it("surfaces 401 responses as typed HTTP errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('{"message":"Unauthorized"}', {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      streamQa({ query: "hello" }, vi.fn(), { fetchImpl }),
    ).rejects.toEqual(expect.objectContaining({ status: 401 }));
  });

  it("rejects malformed or incomplete streams", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(sseResponse(['data: {"type":"delta","content":42}\n\n']));

    await expect(
      streamQa({ query: "hello" }, vi.fn(), { fetchImpl }),
    ).rejects.toThrow("Invalid QA stream event");
  });
});
