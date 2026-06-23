import type { IdpProvider } from "@pas/clients";
import type { UserRole } from "@pas/shared";

export const SESSION_COOKIE_NAME = "pas_session";
export const OAUTH_STATE_COOKIE_NAME = "pas_oauth_state";
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_OAUTH_STATE_TTL_SECONDS = 5 * 60;
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

function secureAttribute(secure: boolean): string[] {
  return secure ? ["Secure"] : [];
}

export function serializeSessionCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    ...secureAttribute(secure),
    "SameSite=Lax",
  ].join("; ");
}

export function serializeExpiredSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    ...secureAttribute(secure),
    "SameSite=Lax",
  ].join("; ");
}

export function serializeOAuthStateCookie(
  state: string,
  maxAgeSeconds = DEFAULT_OAUTH_STATE_TTL_SECONDS,
): string {
  return [
    `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ].join("; ");
}

export function serializeExpiredOAuthStateCookie(): string {
  return [
    `${OAUTH_STATE_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ].join("; ");
}
