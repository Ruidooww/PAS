import type { AuthenticatedRequest, SessionPayload } from "../auth/types";

export interface AuditHttpRequest extends AuthenticatedRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
}

export interface AuditHttpResponse {
  statusCode?: number;
}

export function requestAction(request: AuditHttpRequest): string {
  return request.method ?? "UNKNOWN";
}

export function requestResource(request: AuditHttpRequest): string {
  return request.originalUrl ?? request.url ?? "unknown";
}

export function requestUser(request: AuditHttpRequest): SessionPayload | undefined {
  return request.user;
}
