export class SseHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SseHttpError";
  }
}

export interface StreamSseOptions {
  url: string;
  init: RequestInit;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function streamSse(
  options: StreamSseOptions,
  onPayload: (data: unknown) => void,
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const init = options.signal
    ? { ...options.init, signal: options.signal }
    : options.init;
  const response = await fetchImpl(options.url, init);

  if (!response.ok) {
    throw new SseHttpError(response.status, await responseErrorMessage(response));
  }
  if (!response.body) throw new Error("SSE response has no readable stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = findFrameBoundary(buffer);
    while (boundary) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      const data = parseFrame(frame);
      if (data !== undefined) onPayload(data);
      boundary = findFrameBoundary(buffer);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const data = parseFrame(buffer);
    if (data !== undefined) onPayload(data);
  }
}

function findFrameBoundary(buffer: string): { index: number; length: number } | null {
  const lfIndex = buffer.indexOf("\n\n");
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  if (lfIndex === -1 && crlfIndex === -1) return null;
  if (lfIndex === -1) return { index: crlfIndex, length: 4 };
  if (crlfIndex === -1 || lfIndex < crlfIndex) return { index: lfIndex, length: 2 };
  return { index: crlfIndex, length: 4 };
}

function parseFrame(frame: string): unknown {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return undefined;
  try {
    return JSON.parse(data);
  } catch {
    throw new Error("Invalid JSON in SSE event");
  }
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `SSE request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as unknown;
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}
