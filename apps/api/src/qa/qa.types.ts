import type { ChatMessage } from "@pas/shared";

export interface QaRequest {
  query: string;
  sessionId?: string;
  history?: ChatMessage[];
}

export interface QaRef {
  n: number;
  docName: string;
  page?: number;
}

export type QaStreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; content: string }
  | { type: "refs"; refs: QaRef[] }
  | { type: "done" };
