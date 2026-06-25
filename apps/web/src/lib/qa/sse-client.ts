import { SseHttpError, streamSse } from "../sse-client";

import type { QaReference, QaRequest, QaStreamEvent } from "./types";

export { SseHttpError as QaHttpError };

type FetchImplementation = typeof fetch;

interface StreamQaOptions {
  fetchImpl?: FetchImplementation;
  signal?: AbortSignal;
}

export async function streamQa(
  request: QaRequest,
  onEvent: (event: QaStreamEvent) => void,
  options: StreamQaOptions = {},
): Promise<void> {
  let completed = false;
  await streamSse(
    {
      url: "/api/internal/qa",
      init: {
        method: "POST",
        credentials: "include",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      },
      fetchImpl: options.fetchImpl,
      signal: options.signal,
    },
    (payload) => {
      if (!isQaStreamEvent(payload)) throw new Error("Invalid QA stream event");
      onEvent(payload);
      if (payload.type === "done") completed = true;
    },
  );
  if (!completed) throw new Error("QA stream ended before done event");
}

function isQaStreamEvent(value: unknown): value is QaStreamEvent {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "session":
      return typeof value.sessionId === "string";
    case "delta":
      return typeof value.content === "string";
    case "refs":
      return Array.isArray(value.refs) && value.refs.every(isQaReference);
    case "message":
      return typeof value.messageId === "string";
    case "done":
      return true;
    default:
      return false;
  }
}

function isQaReference(value: unknown): value is QaReference {
  return (
    isRecord(value) &&
    typeof value.n === "number" &&
    Number.isInteger(value.n) &&
    typeof value.docName === "string" &&
    (value.page === undefined || typeof value.page === "number")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
