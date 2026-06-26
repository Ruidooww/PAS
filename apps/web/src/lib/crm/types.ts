export type CustomerSource = "mock" | "external";
export type ProposalStatus = "draft" | "generating" | "review" | "final";

export interface CustomerSummary {
  ref: string;
  name: string;
  industry: string | null;
  scale: number | null;
  ownerId: string | null;
  source: CustomerSource;
}

export interface CustomerProposalSummary {
  id: string;
  title: string;
  status: ProposalStatus;
  version: number;
  createdAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  syncedAt: string;
  proposals: CustomerProposalSummary[];
}

export interface OpportunitySummary {
  ref: string;
  customerRef: string;
  title: string;
  stage: string;
  amountEstimate: number | null;
  ownerId: string | null;
}

export interface CustomerListResponse {
  items: CustomerSummary[];
  page: number;
  fromCache?: boolean;
}

export interface OpportunityListResponse {
  items: OpportunitySummary[];
  page: number;
  fromCache?: boolean;
}
