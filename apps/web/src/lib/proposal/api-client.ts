import type {
  DraftRequirementForm,
  Proposal,
  ProposalContent,
  ProposalTemplateSummary,
  ProposalVersionRecord,
} from "./types";

export class ProposalApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProposalApiError";
  }
}

async function jsonRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new ProposalApiError(
      response.status,
      await readErrorMessage(response),
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Proposal API request failed with status ${response.status}`;
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

export async function createProposalDraft(input: {
  formFields: DraftRequirementForm;
  freeText?: string;
}): Promise<Proposal> {
  return jsonRequest<Proposal>("/api/internal/proposals/draft-requirement", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listProposalTemplates(): Promise<ProposalTemplateSummary[]> {
  return jsonRequest<ProposalTemplateSummary[]>("/api/internal/proposal-templates");
}

export async function enqueueProposalGeneration(
  proposalId: string,
  templateId: string,
): Promise<{ proposalId: string; status: string }> {
  return jsonRequest(`/api/internal/proposals/${encodeURIComponent(proposalId)}/generate`, {
    method: "POST",
    body: JSON.stringify({ templateId }),
  });
}

export async function getProposal(proposalId: string): Promise<Proposal> {
  return jsonRequest<Proposal>(
    `/api/internal/proposals/${encodeURIComponent(proposalId)}`,
  );
}

export interface ProposalListResponse {
  items: Proposal[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listProposals(params: {
  customerRef?: string;
  page?: number;
} = {}): Promise<ProposalListResponse> {
  const search = new URLSearchParams();
  if (params.customerRef) search.set("customerRef", params.customerRef);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return jsonRequest<ProposalListResponse>(
    `/api/internal/proposals${qs ? `?${qs}` : ""}`,
  );
}

interface WaitForGeneratedProposalOptions {
  intervalMs?: number;
  load?: (proposalId: string) => Promise<Proposal>;
  onProposal?: (proposal: Proposal) => void;
  signal?: AbortSignal;
  wait?: (intervalMs: number, signal?: AbortSignal) => Promise<void>;
}

export async function waitForGeneratedProposal(
  proposalId: string,
  options: WaitForGeneratedProposalOptions = {},
): Promise<Proposal> {
  const load = options.load ?? getProposal;
  const wait = options.wait ?? waitForInterval;
  const intervalMs = options.intervalMs ?? 2_000;

  while (true) {
    throwIfAborted(options.signal);
    const proposal = await load(proposalId);
    options.onProposal?.(proposal);
    if (proposal.contentJson) return proposal;
    await wait(intervalMs, options.signal);
  }
}

export async function patchProposalSection(
  proposalId: string,
  section: { id: string; body: string },
): Promise<Proposal> {
  return jsonRequest<Proposal>(
    `/api/internal/proposals/${encodeURIComponent(proposalId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ section }),
    },
  );
}

export async function finalizeProposal(proposalId: string): Promise<Proposal> {
  return jsonRequest<Proposal>(
    `/api/internal/proposals/${encodeURIComponent(proposalId)}/finalize`,
    { method: "POST" },
  );
}

export async function listProposalVersions(
  proposalId: string,
): Promise<ProposalVersionRecord[]> {
  return jsonRequest<ProposalVersionRecord[]>(
    `/api/internal/proposals/${encodeURIComponent(proposalId)}/versions`,
  );
}

export function proposalExportUrl(
  proposalId: string,
  format: "docx" | "md",
): string {
  return `/api/internal/proposals/${encodeURIComponent(proposalId)}/export?format=${format}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("Proposal generation polling aborted");
  error.name = "AbortError";
  throw error;
}

function waitForInterval(intervalMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, intervalMs);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      const error = new Error("Proposal generation polling aborted");
      error.name = "AbortError";
      reject(error);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export type { ProposalContent };
