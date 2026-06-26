import type { Metadata } from "next";

import { CustomerListView } from "../../components/crm/customer-list-view";

export const metadata: Metadata = {
  title: "客户列表 | PAS",
};

export default function CustomersPage() {
  return <CustomerListView />;
}
