import { QaHttpError } from "./sse-client";
import type { FeedbackRating } from "./types";

export async function submitQaFeedback(
  messageId: string,
  rating: FeedbackRating,
): Promise<void> {
  const response = await fetch("/api/internal/qa/feedback", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageId, rating }),
  });
  if (!response.ok) {
    throw new QaHttpError(response.status, `Feedback request failed with status ${response.status}`);
  }
}
