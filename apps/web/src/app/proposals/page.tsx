import type { Metadata } from "next";

import { ProposalListView } from "../../components/proposal/proposal-list-view";

export const metadata: Metadata = {
  title: "方案列表 | PAS",
};

export default function ProposalsPage() {
  return <ProposalListView />;
}
