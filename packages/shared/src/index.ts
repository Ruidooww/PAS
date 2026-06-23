export const USER_ROLES = ["admin", "sales", "presales", "delivery"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROPOSAL_STATUSES = ["draft", "final"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const ACL_SCOPES = ["public", "internal"] as const;
export type AclScope =
  | (typeof ACL_SCOPES)[number]
  | `role:${UserRole}`
  | `dept:${string}`;

export const CUSTOMER_SOURCES = ["external", "pas"] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export const FEEDBACK_RATINGS = ["up", "down"] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

export const IDP_PROVIDERS = ["feishu", "mock", "wecom"] as const;
export type IdpProvider = (typeof IDP_PROVIDERS)[number];

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  isExternal: boolean;
  deptId: string | null;
  tenantId: string;
  idpProvider: IdpProvider;
  idpUserId: string;
  avatar: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface CustomerMirror {
  ref: string;
  source: CustomerSource;
  name: string;
  industry: string | null;
  scale: number | null;
  ownerId: string | null;
  syncedAt: string;
}

export interface Customer {
  ref: string;
  name: string;
  industry: string | null;
  scale: number | null;
  ownerId: string | null;
}

export interface Proposal {
  id: string;
  customerRef: string;
  opportunityRef: string | null;
  title: string;
  status: ProposalStatus;
  requirementJson: JsonObject;
  contentJson: JsonObject;
  pptFileKey: string | null;
  createdBy: string;
  version: number;
  createdAt: string;
}

export interface KbDocument {
  id: string;
  ragflowDocId: string;
  ragflowKbId: string;
  title: string;
  product: string | null;
  aclScope: AclScope;
  uploadedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  isExternal: boolean;
  detailJson: JsonObject;
  createdAt: string;
}

export interface ConversationFeedback {
  id: string;
  userId: string;
  query: string;
  answer: string;
  rating: FeedbackRating;
  sessionId: string;
  createdAt: string;
}

export interface Opportunity {
  ref: string;
  customerRef: string;
  title: string;
  stage: string;
  amountEstimate: number | null;
  ownerId: string | null;
}

export interface Contract {
  ref: string;
  customerRef: string;
  title: string;
  status: string;
  amount: number | null;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface ChatMessage {
  role: "assistant" | "system" | "user";
  content: string;
}

export interface GraphResult {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
}

export interface RagflowDocument {
  id: string;
  name: string;
  status: string;
}

export interface RagflowDocumentMeta {
  title: string;
  product?: string;
  aclScope?: AclScope;
}