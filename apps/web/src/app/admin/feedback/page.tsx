import type { Metadata } from "next";

import { FeedbackDashboard } from "../../../components/admin/feedback-dashboard";

export const metadata: Metadata = {
  title: "反馈看板 | PAS",
};

export default function AdminFeedbackPage() {
  return <FeedbackDashboard />;
}
