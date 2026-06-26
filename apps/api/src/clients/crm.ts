export const CRM_CLIENT = Symbol("CRM_CLIENT");

export type {
  CrmClient,
  CrmListCustomersParams,
  CrmListOpportunitiesParams,
  CrmProvider,
} from "@pas/clients/crm";
export {
  CrmClientError,
  ExternalCrmClient,
  MockCrmClient,
  PasCrmClient,
} from "@pas/clients/crm";
