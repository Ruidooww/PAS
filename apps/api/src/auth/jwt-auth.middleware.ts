import { Inject, Injectable } from "@nestjs/common";

import { JwtSessionService } from "./jwt-session.service";
import { SESSION_COOKIE_NAME, type AuthenticatedRequest } from "./types";

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

@Injectable()
export class JwtAuthMiddleware {
  constructor(@Inject(JwtSessionService) private readonly jwt: JwtSessionService) {}

  use(req: AuthenticatedRequest, _res: unknown, next: () => void): void {
    const cookieHeader = req.headers?.cookie;
    const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
    const token = parseCookies(header).get(SESSION_COOKIE_NAME);
    if (token) {
      try {
        req.user = this.jwt.verify(token);
      } catch {
        req.user = undefined;
      }
    }
    next();
  }
}