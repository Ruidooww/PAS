import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ChatMessage, Chunk } from "@pas/shared";

import type { SessionClaims } from "../auth/types";
import { LLM_CLIENT, type LlmClient } from "../clients/llm";
import { RAGFLOW_CLIENT, type RagflowClient } from "../clients/ragflow";
import { AclService } from "../internal/acl.service";
import { PrismaService } from "../prisma/prisma.service";
import { QA_PROMPT } from "./qa.prompt";
import type { QaRef, QaRequest, QaStreamEvent } from "./qa.types";

const QA_KB_ID = "e0-mock-kb";
const RETRIEVE_TOP_K = 3;
const HISTORY_TURNS = 5;
const HISTORY_MESSAGE_LIMIT = HISTORY_TURNS * 2;

@Injectable()
export class QaService {
  constructor(
    @Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient,
    @Inject(AclService) private readonly acl: AclService,
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QA_PROMPT) private readonly promptTemplate: string,
  ) {}

  async *answer(request: QaRequest, user: SessionClaims): AsyncIterable<QaStreamEvent> {
    const sessionId = request.sessionId ?? randomUUID();
    yield { type: "session", sessionId };
    const conversation = await this.findOrCreateConversation(sessionId, user.uid);
    const history = request.history?.length
      ? trimHistory(request.history)
      : await this.loadHistory(conversation.id);
    const retrievalQuery = buildRetrievalQuery(history, request.query);
    const visibleDocIds = await this.acl.computeVisibleDocIds(user);
    const retrievedChunks =
      visibleDocIds.length === 0
        ? []
        : await this.ragflowClient.retrieve({
            kbId: QA_KB_ID,
            query: retrievalQuery,
            topK: RETRIEVE_TOP_K,
            docIdWhitelist: visibleDocIds,
          });
    const allowedDocIds = new Set(visibleDocIds);
    const chunks = retrievedChunks.filter((chunk) => allowedDocIds.has(chunk.documentId));

    const messages = buildLlmMessages(this.promptTemplate, chunks, history, request.query);
    let answer = "";
    for await (const delta of this.llmClient.stream({ messages, temperature: 0.2 })) {
      if (!delta) continue;
      answer += delta;
      yield { type: "delta", content: delta };
    }

    const refs = parseRefs(answer, chunks);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: request.query,
        },
      });
      await transaction.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: answer,
          refs: refs as unknown as Prisma.InputJsonValue,
        },
      });
    });
    yield { type: "refs", refs };
    yield { type: "done" };
  }

  private async findOrCreateConversation(
    sessionId: string,
    userId: string,
  ): Promise<{ id: string; sessionId: string }> {
    return this.prisma.conversation.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId },
      update: {},
      select: { id: true, sessionId: true },
    });
  }

  private async loadHistory(conversationId: string): Promise<ChatMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGE_LIMIT,
    });
    return trimHistory(
      [...messages].reverse().map((message) => ({
        role: normalizeRole(message.role),
        content: message.content,
      })),
    );
  }
}

export function buildRetrievalQuery(history: ChatMessage[], query: string): string {
  if (history.length === 0) return query;
  const context = history.map((message) => `${message.role}: ${message.content}`).join("\n");
  return `历史对话：\n${context}\n\n当前问题：${query}`;
}

export function buildLlmMessages(
  promptTemplate: string,
  chunks: Chunk[],
  history: ChatMessage[],
  query: string,
): ChatMessage[] {
  const sources = chunks
    .map((chunk, index) => {
      const ref = refForChunk(index + 1, chunk);
      return `[${ref.n}] ${chunk.content}\n来源：${ref.docName}${ref.page ? ` p.${ref.page}` : ""}`;
    })
    .join("\n\n");
  return [
    {
      role: "system",
      content: `${promptTemplate.trim()}\n\n检索内容：\n${sources || "无检索结果"}`,
    },
    ...trimHistory(history),
    { role: "user", content: query },
  ];
}

export function parseRefs(answer: string, chunks: Chunk[]): QaRef[] {
  const indexes = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1 && n <= chunks.length) indexes.add(n);
  }
  return [...indexes].sort((a, b) => a - b).map((n) => refForChunk(n, chunks[n - 1]!));
}

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-HISTORY_MESSAGE_LIMIT).map((message) => ({
    role: normalizeRole(message.role),
    content: message.content,
  }));
}

function normalizeRole(role: string): ChatMessage["role"] {
  if (role === "assistant" || role === "system" || role === "user") return role;
  return "user";
}

function refForChunk(n: number, chunk: Chunk): QaRef {
  const docName =
    stringMetadata(chunk, "docName") ??
    stringMetadata(chunk, "documentName") ??
    stringMetadata(chunk, "documentKeyword") ??
    chunk.documentId;
  const page = numberMetadata(chunk, "page");
  return page === undefined ? { n, docName } : { n, docName, page };
}

function stringMetadata(chunk: Chunk, key: string): string | undefined {
  const value = chunk.metadata[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberMetadata(chunk: Chunk, key: string): number | undefined {
  const value = chunk.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
