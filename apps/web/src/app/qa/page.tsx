import type { Metadata } from "next";

import { ChatWorkspace } from "../../components/chat/chat-workspace";

export const metadata: Metadata = {
  title: "售前问答 | PAS",
};

export default function QaPage() {
  return <ChatWorkspace />;
}
