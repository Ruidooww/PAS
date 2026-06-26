import type { Metadata } from "next";

import { CustomerDetailView } from "../../../components/crm/customer-detail-view";

export const metadata: Metadata = {
  title: "客户详情 | PAS",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <CustomerDetailView customerRef={decodeURIComponent(ref)} />;
}
