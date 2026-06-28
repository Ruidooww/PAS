import type { Metadata } from "next";

import { WorkshopView } from "../../components/workspace/workshop-view";

export const metadata: Metadata = {
  title: "设置 | PAS",
};

export default function SettingsPage() {
  return <WorkshopView viewId="settings" />;
}
