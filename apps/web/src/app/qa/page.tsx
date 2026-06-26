import type { Metadata } from "next";

import { ChatWorkspace } from "../../components/chat/chat-workspace";
import { AppShell } from "../../components/shell/app-shell";

export const metadata: Metadata = {
  title: "售前问答 | PAS",
};

export default function QaPage() {
  return (
    <AppShell
      pageTitle="知识问答"
      pageDescription="基于 RAGFlow 检索的售前知识库，问任意业务/产品问题即可拿到带引用的答案。"
      breadcrumb={[{ label: "工具", href: "/qa" }, { label: "知识问答" }]}
    >
      <ChatWorkspace />
    </AppShell>
  );
}
