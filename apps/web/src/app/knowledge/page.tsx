import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "知识库 | PAS",
};

export default function KnowledgePage() {
  return <WorkshopView viewId="knowledge" />;
}
