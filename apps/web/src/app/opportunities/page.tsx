import type { Metadata } from "next";

import { OpportunityListView } from "../../components/crm/opportunity-list-view";

export const metadata: Metadata = {
  title: "商机列表 | PAS",
};

export default function OpportunitiesPage() {
  return <OpportunityListView />;
}
