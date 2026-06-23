import type { IdpProvider } from "@pas/clients";
import type { UserRole } from "@pas/shared";

export const SESSION_COOKIE_NAME = "pas_session";
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_TENANT_ID = "tenant-default";
export const DEFAULT_TENANT_NAME = "PAS Default Tenant";

export interface SessionClaims {
  uid: string;
  tenantId: string;
  idpProvider: IdpProvider;
  idpUserId: string;
  name: string;
  email: string | null;
  role: UserRole;
  isExternal: boolean;
  deptId: string | null;
}

export interface SessionPayload extends SessionClaims {
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest {
  headers?: Record<string, string | string[] | undefined>;
  user?: SessionPayload;
}

export interface HeaderResponse {
  setHeader(name: string, value: string | string[]): void;
}

export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function serializeExpiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}