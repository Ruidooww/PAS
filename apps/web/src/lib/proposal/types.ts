export interface ProposalRequirement {
  customer: string;
  industry: string;
  scale: string;
  needs: string[];
  constraints: string[];
}

export type ProposalStatus = "draft" | "draft_ready" | "final";

export interface ProposalSectionRef {
  n: number;
  chunkId?: string;
  docName: string;
  page?: number;
}

export interface ProposalSection {
  id: string;
  title: string;
  body: string;
  refs: ProposalSectionRef[];
}

export interface ProposalContent {
  sections: ProposalSection[];
}

export interface Proposal {
  id: string;
  customerRef: string;
  title: string;
  status: ProposalStatus;
  requirementJson: ProposalRequirement;
  contentJson: ProposalContent | null;
  version: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface ProposalVersionRecord {
  id: string;
  proposalId: string;
  version: number;
  contentJson: ProposalContent | null;
  createdAt: string;
}

export interface ProposalTemplateSummary {
  id: string;
  name: string;
  version: number;
  product: string;
  sections: Array<{ id: string; title: string }>;
}

export interface ProposalProgressEvent {
  chapter?: string;
  n?: number;
  total?: number;
  errorMessage?: string;
  done?: boolean;
}

export interface DraftRequirementForm {
  customerName: string;
  industry: string;
  scale: string;
  needs: string[];
  constraints: string[];
}
