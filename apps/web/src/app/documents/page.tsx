import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "方案文档 | PAS",
};

export default function DocumentsPage() {
  return <WorkshopView viewId="documents" />;
}
