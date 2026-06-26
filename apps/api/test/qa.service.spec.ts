import { Logger } from "@nestjs/common";
import type { Chunk } from "@pas/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionClaims } from "../src/auth/types";
import type { LlmClient } from "../src/clients/llm";
import type { RagflowClient } from "../src/clients/ragflow";
import type { AclService } from "../src/internal/acl.service";
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
  const messageCreate = vi.fn(({ data }: { data: { role: string } }) =>
    Promise.resolve({ id: data.role === "assistant" ? "message-assistant" : "message-user" }),
  );
  return {
    conversation: {
      upsert: vi.fn().mockResolvedValue({ id: "conversation-1", sessionId: "session-1" }),
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
      findFirst: vi.fn().mockResolvedValue({ id: "message-assistant" }),
      create: messageCreate,
    },
    conversationFeedback: {
      upsert: vi.fn().mockResolvedValue({
        messageId: "message-assistant",
        rating: "down",
        comment: "needs correction",
      }),
    },
    $transaction: vi.fn(
      async (callback: (tx: { message: { create: typeof messageCreate } }) => Promise<unknown>) =>
        callback({ message: { create: messageCreate } }),
    ),
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

function aclMock(visibleDocIds = ["doc-1", "doc-2"]): AclService {
  return {
    computeVisibleDocIds: vi.fn().mockResolvedValue(visibleDocIds),
  } as unknown as AclService;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("QaService", () => {
  beforeEach(() => {
    vi.stubEnv("QA_KB_ID", "e0-mock-kb");
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("emits the eight QA timing spans in their fixed order", async () => {
    const log = vi.mocked(Logger.prototype.log);
    const stream = vi.fn(async function* () {
      yield "answer";
    });
    const service = new QaService(
      ragflowMock(),
      aclMock(),
      llmMock(stream),
      prismaMock() as never,
      "Answers must use retrieved context.",
    );

    await collect(service.answer({ query: "timing", sessionId: "session-1" }, user));

    const records = log.mock.calls
      .map(([message]) => JSON.parse(String(message)) as Record<string, unknown>)
      .filter((record) => record.event === "qa_timing");
    expect(records.map((record) => record.span)).toEqual([
      "request_accepted_session_emitted",
      "conversation_history_completed",
      "acl_document_ids_loaded",
      "ragflow_retrieval_started",
      "ragflow_retrieval_completed",
      "llm_request_started",
      "first_llm_delta_received",
      "stream_completed",
    ]);
    expect(records.map((record) => record.spanIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(
      records.every(
        (record) =>
          record.sessionId === "session-1" &&
          typeof record.timestamp === "string" &&
          !Number.isNaN(Date.parse(record.timestamp)) &&
          typeof record.elapsedMs === "number" &&
          record.elapsedMs >= 0,
      ),
    ).toBe(true);
  });

  it("uses QA_KB_ID from the environment for retrieval", async () => {
    vi.stubEnv("QA_KB_ID", "real-ragflow-dataset");
    const retrieve = vi.fn().mockResolvedValue(chunks);
    const stream = vi.fn(async function* () {
      yield "answer";
    });
    const service = new QaService(
      ragflowMock(retrieve),
      aclMock(),
      llmMock(stream),
      prismaMock() as never,
      "答案必须基于检索内容",
    );

    await collect(service.answer({ query: "configured KB", sessionId: "session-1" }, user));

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: "real-ragflow-dataset" }),
    );
  });

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
    const acl = aclMock();
    const service = new QaService(
      ragflowMock(retrieve),
      acl,
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
      docIdWhitelist: ["doc-1", "doc-2"],
    });
    expect(acl.computeVisibleDocIds).toHaveBeenCalledWith(user);
    expect(prisma.conversation.upsert).toHaveBeenCalledWith({
      where: { sessionId_userId: { sessionId: "session-1", userId: "user-1" } },
      create: { sessionId: "session-1", userId: "user-1" },
      update: {},
      select: { id: true, sessionId: true },
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
      { type: "message", messageId: "message-assistant" },
      { type: "done" },
    ]);
    expect(prisma.message.create).toHaveBeenCalledTimes(2);
    expect(prisma.message.create).toHaveBeenNthCalledWith(1, {
      data: {
        conversationId: "conversation-1",
        role: "user",
        content: "控制台加密策略怎么设置",
      },
    });
    expect(prisma.message.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        conversationId: "conversation-1",
        role: "assistant",
        content: "进入策略中心并新建策略 [1][2]",
      }),
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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
      aclMock(),
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

  it("starts ACL lookup before conversation preparation completes and preserves ACL and history", async () => {
    const conversation = deferred<{ id: string; sessionId: string }>();
    const visibleDocIds = deferred<string[]>();
    const prisma = prismaMock([
      { role: "user", content: "previous question" },
      { role: "assistant", content: "previous answer [1]" },
    ]);
    prisma.conversation.upsert.mockReturnValue(conversation.promise);
    const acl = {
      computeVisibleDocIds: vi.fn().mockReturnValue(visibleDocIds.promise),
    } as unknown as AclService;
    const retrieve = vi.fn().mockResolvedValue(chunks);
    const stream = vi.fn(async function* (params: Parameters<LlmClient["stream"]>[0]) {
      expect(params.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "previous question" }),
          expect.objectContaining({ role: "assistant", content: "previous answer [1]" }),
        ]),
      );
      expect(params.messages[0]?.content).toContain(chunks[0]!.content);
      expect(params.messages[0]?.content).not.toContain(chunks[1]!.content);
      yield "answer [1]";
    });
    const service = new QaService(
      ragflowMock(retrieve),
      acl,
      llmMock(stream),
      prisma as never,
      "Answers must use retrieved context.",
    );

    const answer = collect(
      service.answer({ query: "follow-up", sessionId: "session-1" }, user),
    );

    await vi.waitFor(() => {
      expect(prisma.conversation.upsert).toHaveBeenCalledTimes(1);
      expect(acl.computeVisibleDocIds).toHaveBeenCalledWith(user);
    });
    conversation.resolve({ id: "conversation-1", sessionId: "session-1" });
    visibleDocIds.resolve(["doc-1"]);
    await answer;

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ docIdWhitelist: ["doc-1"] }),
    );
  });

  it("does not persist either message when the LLM stream fails", async () => {
    const stream = vi.fn(async function* () {
      yield "partial";
      throw new Error("llm stream failed");
    });
    const prisma = prismaMock();
    const service = new QaService(
      ragflowMock(),
      aclMock(),
      llmMock(stream),
      prisma as never,
      "答案必须基于检索内容",
    );

    await expect(
      collect(service.answer({ query: "控制台加密策略怎么设置", sessionId: "session-1" }, user)),
    ).rejects.toThrow("llm stream failed");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("does not call RAGFlow retrieval when the user has no visible documents", async () => {
    const retrieve = vi.fn();
    const stream = vi.fn(async function* () {
      yield "未找到可见资料";
    });
    const service = new QaService(
      ragflowMock(retrieve),
      aclMock([]),
      llmMock(stream),
      prismaMock() as never,
      "答案必须基于检索内容",
    );

    await collect(service.answer({ query: "acl question", sessionId: "session-1" }, user));

    expect(retrieve).not.toHaveBeenCalled();
  });

  it("upserts feedback for an assistant message owned by the current user", async () => {
    const prisma = prismaMock();
    const service = new QaService(
      ragflowMock(),
      aclMock(),
      llmMock(),
      prisma as never,
      "答案必须基于检索内容",
    );

    await expect(
      service.submitFeedback(
        { messageId: "message-assistant", rating: "down", comment: "needs correction" },
        user,
      ),
    ).resolves.toEqual({
      messageId: "message-assistant",
      rating: "down",
      comment: "needs correction",
    });

    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: {
        id: "message-assistant",
        role: "assistant",
        conversation: { userId: "user-1" },
      },
      select: { id: true },
    });
    expect(prisma.conversationFeedback.upsert).toHaveBeenCalledWith({
      where: { messageId: "message-assistant" },
      create: {
        messageId: "message-assistant",
        userId: "user-1",
        rating: "down",
        comment: "needs correction",
      },
      update: {
        rating: "down",
        comment: "needs correction",
      },
      select: {
        messageId: true,
        rating: true,
        comment: true,
      },
    });
  });
});
