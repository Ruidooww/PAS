import type { Metadata } from "next";

import { ProposalWorkspaceView } from "../../../../components/workspace/proposal-workspace-view";

export const metadata: Metadata = {
  title: "方案工作台 | PAS",
};

export default async function ProposalWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalWorkspaceView proposalId={id} />;
}
