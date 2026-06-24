import type { Chunk } from "@pas/shared";
import { describe, expect, it, vi } from "vitest";

import type { SessionClaims } from "../src/auth/types";
import type { LlmClient } from "../src/clients/llm";
import type { RagflowClient } from "../src/clients/ragflow";
import { QaService } from "../src/qa/qa.service";

const user: SessionClaims = {
  uid: "user-1",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "mock-user-1",
  name: "Mock User",
  email: "mock.presales@example.com",
  role: "presales",
  isExternal: false,
  deptId: "dept-presales",
};

const chunks: Chunk[] = [
  {
    id: "chunk-1",
    documentId: "doc-1",
    content: "控制台路径：策略中心 > 加密策略 > 新建策略。",
    score: 0.92,
    metadata: { docName: "Web控制台说明.pdf", page: 24 },
  },
  {
    id: "chunk-2",
    documentId: "doc-2",
    content: "WPS 授权软件库默认包含 WPS Office。",
    score: 0.88,
    metadata: { docName: "授权软件库.pdf", page: 8 },
  },
];

function prismaMock(messages: Array<{ role: string; content: string }> = []) {
  return {
    conversation: {
      findFirst: vi.fn().mockResolvedValue({ id: "conversation-1", sessionId: "session-1" }),
      create: vi.fn(),
    },
    message: {
      findMany: vi.fn().mockResolvedValue(
        messages
          .map((message, index) => ({
            id: `message-${index}`,
            conversationId: "conversation-1",
            role: message.role,
            content: message.content,
            refs: null,
            createdAt: new Date(index),
          }))
          .reverse(),
      ),
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

function ragflowMock(retrieve = vi.fn().mockResolvedValue(chunks)): RagflowClient {
  return {
    retrieve,
    chat: vi.fn(),
    graphQuery: vi.fn(),
    listDocs: vi.fn(),
    uploadDoc: vi.fn(),
  } as unknown as RagflowClient;
}

function llmMock(stream = vi.fn()): LlmClient {
  return {
    complete: vi.fn(),
    stream,
  } as unknown as LlmClient;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe("QaService", () => {
  it("builds a retrieval-grounded prompt, streams deltas, and emits parsed refs", async () => {
    const retrieve = vi.fn().mockResolvedValue(chunks);
    const stream = vi.fn(async function* (params: Parameters<LlmClient["stream"]>[0]) {
      expect(params.messages[0]?.content).toContain("答案必须基于检索内容");
      expect(params.messages[0]?.content).toContain("[1] 控制台路径");
      expect(params.messages[0]?.content).toContain("Web控制台说明.pdf");
      yield "进入策略中心";
      yield "并新建策略 [1][2]";
    });
    const prisma = prismaMock();
    const service = new QaService(
      ragflowMock(retrieve),
      llmMock(stream),
      prisma as never,
      "答案必须基于检索内容\n每个结论标 [n] 引用",
    );

    const events = await collect(
      service.answer({ query: "控制台加密策略怎么设置", sessionId: "session-1" }, user),
    );

    expect(retrieve).toHaveBeenCalledWith({
      kbId: "e0-mock-kb",
      query: "控制台加密策略怎么设置",
      topK: 3,
    });
    expect(events).toEqual([
      { type: "session", sessionId: "session-1" },
      { type: "delta", content: "进入策略中心" },
      { type: "delta", content: "并新建策略 [1][2]" },
      {
        type: "refs",
        refs: [
          { n: 1, docName: "Web控制台说明.pdf", page: 24 },
          { n: 2, docName: "授权软件库.pdf", page: 8 },
        ],
      },
      { type: "done" },
    ]);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "assistant", content: "进入策略中心并新建策略 [1][2]" }),
    });
  });

  it("injects recent DB history into retrieval and LLM messages for follow-up questions", async () => {
    const retrieve = vi.fn().mockResolvedValue(chunks);
    const stream = vi.fn(async function* (params: Parameters<LlmClient["stream"]>[0]) {
      expect(params.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "控制台加密策略怎么设置" }),
          expect.objectContaining({ role: "assistant", content: "进入策略中心 [1]" }),
          expect.objectContaining({ role: "user", content: "延申一下" }),
        ]),
      );
      yield "延申说明 [1]";
    });
    const service = new QaService(
      ragflowMock(retrieve),
      llmMock(stream),
      prismaMock([
        { role: "user", content: "控制台加密策略怎么设置" },
        { role: "assistant", content: "进入策略中心 [1]" },
      ]) as never,
      "答案必须基于检索内容",
    );

    await collect(service.answer({ query: "延申一下", sessionId: "session-1" }, user));

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("控制台加密策略怎么设置"),
      }),
    );
    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("延申一下"),
      }),
    );
  });
});
