export interface QaReference {
  n: number;
  docName: string;
  page?: number;
}

export type QaStreamEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; content: string }
  | { type: "refs"; refs: QaReference[] }
  | { type: "message"; messageId: string }
  | { type: "done" };

export interface QaRequest {
  query: string;
  sessionId?: string;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  refs?: QaReference[];
  messageId?: string;
  streaming?: boolean;
  feedback?: FeedbackRating;
}

export type FeedbackRating = "down" | "up";
