import type { ChatMessage, FeedbackRating } from "@pas/shared";

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

export interface QaFeedbackRequest {
  messageId: string;
  rating: FeedbackRating;
  comment?: string;
}

export interface QaFeedbackResult {
  messageId: string;
  rating: FeedbackRating;
  comment: string | null;
}

export type QaStreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; content: string }
  | { type: "refs"; refs: QaRef[] }
  | { type: "message"; messageId: string }
  | { type: "done" };
