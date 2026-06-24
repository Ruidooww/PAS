import type { QaReference, QaRequest, QaStreamEvent } from "./types";

type FetchImplementation = typeof fetch;

interface StreamQaOptions {
  fetchImpl?: FetchImplementation;
  signal?: AbortSignal;
}

export class QaHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "QaHttpError";
  }
}

export async function streamQa(
  request: QaRequest,
  onEvent: (event: QaStreamEvent) => void,
  options: StreamQaOptions = {},
): Promise<void> {
  const response = await (options.fetchImpl ?? fetch)("/api/internal/qa", {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new QaHttpError(response.status, await responseErrorMessage(response));
  }
  if (!response.body) throw new Error("QA response has no readable stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = findFrameBoundary(buffer);
    while (boundary) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      const event = parseFrame(frame);
      if (event) {
        onEvent(event);
        if (event.type === "done") completed = true;
      }
      boundary = findFrameBoundary(buffer);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseFrame(buffer);
    if (event) {
      onEvent(event);
      if (event.type === "done") completed = true;
    }
  }
  if (!completed) throw new Error("QA stream ended before done event");
}

function findFrameBoundary(buffer: string): { index: number; length: number } | null {
  const lfIndex = buffer.indexOf("\n\n");
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  if (lfIndex === -1 && crlfIndex === -1) return null;
  if (lfIndex === -1) return { index: crlfIndex, length: 4 };
  if (crlfIndex === -1 || lfIndex < crlfIndex) return { index: lfIndex, length: 2 };
  return { index: crlfIndex, length: 4 };
}

function parseFrame(frame: string): QaStreamEvent | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;

  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error("Invalid JSON in QA stream event");
  }
  if (!isQaStreamEvent(value)) throw new Error("Invalid QA stream event");
  return value;
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

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `QA request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as unknown;
    if (isRecord(body) && typeof body.message === "string") return body.message;
  } catch {
    return fallback;
  }
  return fallback;
}
