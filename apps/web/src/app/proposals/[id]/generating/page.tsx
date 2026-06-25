import type { Metadata } from "next";

import { ProposalGeneratingView } from "../../../../components/proposal/proposal-generating-view";

export const metadata: Metadata = {
  title: "方案生成中 | PAS",
};

export default async function ProposalGeneratingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalGeneratingView proposalId={id} />;
}
