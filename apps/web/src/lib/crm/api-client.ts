import type {
  CustomerDetail,
  CustomerListResponse,
  OpportunityListResponse,
  OpportunitySummary,
} from "./types";

export class CrmApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CrmApiError";
  }
}

async function jsonRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const fallback = `CRM API error ${response.status}`;
    let message = fallback;
    try {
      const body = (await response.json()) as unknown;
      if (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string") {
        message = (body as { message: string }).message;
      }
    } catch {
      // use fallback
    }
    throw new CrmApiError(response.status, message);
  }
  return (await response.json()) as T;
}

export async function listCustomers(params: {
  q?: string;
  ownerId?: string;
  page?: number;
}): Promise<CustomerListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.ownerId) search.set("ownerId", params.ownerId);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return jsonRequest<CustomerListResponse>(`/api/internal/customers${qs ? `?${qs}` : ""}`);
}

export async function getCustomer(ref: string): Promise<CustomerDetail> {
  return jsonRequest<CustomerDetail>(`/api/internal/customers/${encodeURIComponent(ref)}`);
}

export async function listOpportunities(params: {
  customerRef?: string;
  stage?: string;
  page?: number;
}): Promise<OpportunityListResponse> {
  const search = new URLSearchParams();
  if (params.customerRef) search.set("customerRef", params.customerRef);
  if (params.stage) search.set("stage", params.stage);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return jsonRequest<OpportunityListResponse>(`/api/internal/opportunities${qs ? `?${qs}` : ""}`);
}

export async function getOpportunity(ref: string): Promise<OpportunitySummary> {
  return jsonRequest<OpportunitySummary>(`/api/internal/opportunities/${encodeURIComponent(ref)}`);
}
