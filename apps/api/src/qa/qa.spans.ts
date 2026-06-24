export const QA_TIMING_SPANS = [
  "request_accepted_session_emitted",
  "conversation_history_completed",
  "acl_document_ids_loaded",
  "ragflow_retrieval_started",
  "ragflow_retrieval_completed",
  "llm_request_started",
  "first_llm_delta_received",
  "stream_completed",
] as const;

export type QaTimingSpan = (typeof QA_TIMING_SPANS)[number];

export interface QaTimingRecord {
  event: "qa_timing";
  sessionId: string;
  span: QaTimingSpan;
  spanIndex: number;
  timestamp: string;
  elapsedMs: number;
}

export function qaTimingSpanIndex(span: QaTimingSpan): number {
  return QA_TIMING_SPANS.indexOf(span) + 1;
}
