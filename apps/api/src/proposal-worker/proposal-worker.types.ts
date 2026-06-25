import type { Prisma } from "@prisma/client";

export interface ProposalGenerationJob {
  proposalId: string;
  requirementJson: Prisma.JsonValue;
  templateId: string;
  userId: string;
}

export interface ProposalProgressEvent {
  chapter?: string;
  n?: number;
  total?: number;
  errorMessage?: string;
  done?: boolean;
}

export interface ProposalSectionReference {
  n: number;
  chunkId: string;
  docName: string;
  page?: number;
}

export interface GeneratedProposalSection {
  title: string;
  body: string;
  refs: ProposalSectionReference[];
}
