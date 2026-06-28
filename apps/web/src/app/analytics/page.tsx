import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "数据分析 | PAS",
};

export default function AnalyticsPage() {
  return <WorkshopView viewId="analytics" />;
}
