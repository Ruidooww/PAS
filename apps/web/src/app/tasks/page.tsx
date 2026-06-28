import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "任务检查 | PAS",
};

export default function TasksPage() {
  return <WorkshopView viewId="tasks" />;
}
