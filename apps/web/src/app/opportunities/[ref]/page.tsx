import type { Metadata } from "next";

import { OpportunityDetailView } from "../../../components/crm/opportunity-detail-view";

export const metadata: Metadata = {
  title: "商机详情 | PAS",
};

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <OpportunityDetailView opportunityRef={decodeURIComponent(ref)} />;
}
