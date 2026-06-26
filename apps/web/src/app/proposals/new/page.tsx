import type { Metadata } from "next";

import { ProposalNewForm } from "../../../components/proposal/proposal-new-form";

export const metadata: Metadata = {
  title: "新建方案 | PAS",
};

export default function ProposalNewPage() {
  return <ProposalNewForm />;
}
