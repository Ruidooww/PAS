import type { KbDocumentsResponse } from "./types";

export class KbDocumentsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "KbDocumentsApiError";
  }
}

export async function listKbDocuments(): Promise<KbDocumentsResponse> {
  const response = await fetch("/api/internal/kb-documents", {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new KbDocumentsApiError(response.status, `KB documents API error ${response.status}`);
  }
  return (await response.json()) as KbDocumentsResponse;
}
