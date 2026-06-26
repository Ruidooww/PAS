import type { Customer, CustomerSource, Opportunity, ProposalStatus } from "@pas/shared";

import { Sensitive } from "../sanitize/sensitive.decorator";

export class CustomerDto implements Customer {
  ref!: string;
  name!: string;
  industry!: string | null;
  scale!: number | null;
  ownerId!: string | null;
  source!: CustomerSource;

  constructor(customer: Customer, source: CustomerSource) {
    Object.assign(this, customer);
    this.source = source;
  }
}

export interface CustomerProposalSummary {
  id: string;
  title: string;
  status: ProposalStatus;
  version: number;
  createdAt: string;
}

export class CustomerDetailDto extends CustomerDto {
  syncedAt!: string;
  proposals!: CustomerProposalSummary[];

  constructor(
    customer: Customer,
    source: CustomerSource,
    syncedAt: Date,
    proposals: CustomerProposalSummary[],
  ) {
    super(customer, source);
    this.syncedAt = syncedAt.toISOString();
    this.proposals = proposals;
  }
}

export class OpportunityDto implements Opportunity {
  ref!: string;
  customerRef!: string;
  title!: string;
  stage!: string;

  @Sensitive({ maskFor: ["external"] })
  amountEstimate!: number | null;

  ownerId!: string | null;

  constructor(opportunity: Opportunity) {
    Object.assign(this, opportunity);
  }
}

export interface CustomerListResponse {
  items: CustomerDto[];
  page: number;
  fromCache?: boolean;
}

export interface OpportunityListResponse {
  items: OpportunityDto[];
  page: number;
  fromCache?: boolean;
}
