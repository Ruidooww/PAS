import { createHmac, timingSafeEqual } from "node:crypto";

import type { SessionClaims, SessionPayload } from "./types";

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function signHmac(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class JwtSessionService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {
    if (secret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters");
    }
  }

  sign(claims: SessionClaims): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = { ...claims, iat: now, exp: now + this.ttlSeconds };
    const unsigned = `${base64UrlJson({ alg: "HS256", typ: "JWT" })}.${base64UrlJson(payload)}`;
    return `${unsigned}.${signHmac(unsigned, this.secret)}`;
  }

  verify(token: string): SessionPayload {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid session token");
    const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    if (!safeEqual(signature, signHmac(unsigned, this.secret))) {
      throw new Error("Invalid session token");
    }
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
      alg?: string;
    };
    if (header.alg !== "HS256") throw new Error("Invalid session token algorithm");
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error("Session token expired");
    }
    if (
      typeof payload.uid !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.idpProvider !== "string" ||
      typeof payload.idpUserId !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.isExternal !== "boolean"
    ) {
      throw new Error("Invalid session token claims");
    }
    return payload;
  }
}