import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "商机阶段 | PAS",
};

export default function OpportunitiesPage() {
  return <WorkshopView viewId="opportunities" />;
}
