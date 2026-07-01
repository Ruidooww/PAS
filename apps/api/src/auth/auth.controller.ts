import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { parseIdpProvider } from "./idp.registry";
import {
  DEFAULT_SESSION_TTL_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
  serializeExpiredOAuthStateCookie,
  serializeExpiredSessionCookie,
  serializeOAuthStateCookie,
  serializeSessionCookie,
  type AuthenticatedRequest,
  type HeaderResponse,
} from "./types";

function readCookie(req: AuthenticatedRequest, name: string): string | undefined {
  const cookieHeader = req.headers?.cookie;
  const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  for (const part of header?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name && rawValue.length > 0) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

function redirect(response: HeaderResponse, location: string): { statusCode: number; url: string } {
  response.setHeader("Location", location);
  return { statusCode: 302, url: location };
}

function normalizeReturnUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\r") || value.includes("\n")) return null;
  return value;
}

function createOAuthState(returnUrl: string | undefined): string | undefined {
  const normalizedReturnUrl = normalizeReturnUrl(returnUrl);
  if (!normalizedReturnUrl) return undefined;
  return Buffer.from(
    JSON.stringify({ nonce: randomUUID(), returnUrl: normalizedReturnUrl }),
  ).toString("base64url");
}

function returnUrlFromState(state: string | undefined): string | null {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      returnUrl?: unknown;
    };
    return normalizeReturnUrl(parsed.returnUrl);
  } catch {
    return null;
  }
}

@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Get("auth/login")
  @HttpCode(302)
  login(
    @Query("provider") providerParam: string | undefined,
    @Query("returnUrl") returnUrlParam: string | undefined,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): { statusCode: number; url: string } {
    const provider = parseIdpProvider(providerParam);
    const login = this.auth.buildLoginUrl(provider, createOAuthState(returnUrlParam));
    response.setHeader("Set-Cookie", serializeOAuthStateCookie(login.state));
    return redirect(response, login.url);
  }

  @Get("auth/callback")
  @HttpCode(302)
  async callback(
    @Query("provider") providerParam: string | undefined,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<{ statusCode: number; url: string }> {
    response.setHeader("Set-Cookie", serializeExpiredOAuthStateCookie());
    if (!code) throw new BadRequestException("code is required");
    const provider = parseIdpProvider(providerParam);
    const expectedState = readCookie(req, OAUTH_STATE_COOKIE_NAME);
    if (expectedState === undefined) {
      throw new BadRequestException("OAuth state cookie is missing");
    }
    const { token } = await this.auth.completeCallback(provider, code, expectedState, state);
    const maxAge = this.config.get<number>("JWT_SESSION_TTL_SECONDS") ?? DEFAULT_SESSION_TTL_SECONDS;
    response.setHeader("Set-Cookie", [
      serializeExpiredOAuthStateCookie(),
      serializeSessionCookie(token, maxAge, this.useSecureSessionCookie()),
    ]);
    return redirect(response, returnUrlFromState(state) ?? "/");
  }

  @Post("auth/logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: HeaderResponse): void {
    response.setHeader("Set-Cookie", serializeExpiredSessionCookie(this.useSecureSessionCookie()));
  }

  @Get("api/me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest): unknown {
    return req.user;
  }

  private useSecureSessionCookie(): boolean {
    const appBaseUrl = this.config.get<string>("APP_BASE_URL");
    if (appBaseUrl) {
      return new URL(appBaseUrl).protocol === "https:";
    }
    return this.config.get<string>("NODE_ENV") === "production";
  }
}
