import type { Metadata } from "next";

import { OpportunityNewForm } from "../../../components/crm/opportunity-new-form";

export const metadata: Metadata = {
  title: "新建商机 | PAS",
};

export default function NewOpportunityPage() {
  return <OpportunityNewForm />;
}
