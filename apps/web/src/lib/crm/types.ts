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

export type OpportunityStage =
  | "discovery"
  | "qualified"
  | "evaluation"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface CreateOpportunityInput {
  customerRef: string;
  title: string;
  stage: OpportunityStage;
  amountEstimate: number | null;
}

export interface CustomerPortrait {
  ref: string;
  name: string;
  industry?: string | null;
  scale?: number | null;
  ownerId?: string | null;
  opportunities: {
    total: number;
    byStage: Record<string, number>;
    latestUpdatedAt: string | null;
    totalAmountEstimate: number;
  };
  proposals: {
    total: number;
    latestStatus: string | null;
    latestUpdatedAt: string | null;
  };
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
