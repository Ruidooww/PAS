import { streamSse } from "../sse-client";
import type { ProposalProgressEvent } from "./types";

export { SseHttpError as ProposalProgressError } from "../sse-client";

interface StreamProgressOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function streamProposalProgress(
  proposalId: string,
  onEvent: (event: ProposalProgressEvent) => void,
  options: StreamProgressOptions = {},
): Promise<void> {
  let completed = false;
  await streamSse(
    {
      url: `/api/internal/proposals/${encodeURIComponent(proposalId)}/progress`,
      init: {
        method: "GET",
        credentials: "include",
        headers: { accept: "text/event-stream" },
      },
      fetchImpl: options.fetchImpl,
      signal: options.signal,
    },
    (payload) => {
      if (!isProgressEvent(payload)) throw new Error("Invalid proposal progress event");
      onEvent(payload);
      if (payload.done) completed = true;
    },
  );
  if (!completed) throw new Error("Proposal progress stream ended before done");
}

function isProgressEvent(value: unknown): value is ProposalProgressEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.chapter === undefined || typeof record.chapter === "string") &&
    (record.n === undefined || typeof record.n === "number") &&
    (record.total === undefined || typeof record.total === "number") &&
    (record.errorMessage === undefined || typeof record.errorMessage === "string") &&
    (record.done === undefined || typeof record.done === "boolean")
  );
}
