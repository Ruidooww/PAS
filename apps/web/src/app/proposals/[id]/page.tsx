import type { Metadata } from "next";

import { ProposalDetailView } from "../../../components/proposal/proposal-detail-view";

export const metadata: Metadata = {
  title: "方案详情 | PAS",
};

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalDetailView proposalId={id} />;
}
