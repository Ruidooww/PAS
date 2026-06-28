import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "AI 助手 | PAS",
};

export default function QaPage() {
  return <WorkshopView viewId="qa" />;
}
