import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { parseIdpProvider } from "./idp.registry";
import {
  DEFAULT_SESSION_TTL_SECONDS,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  type AuthenticatedRequest,
  type HeaderResponse,
} from "./types";

function requestOrigin(req: AuthenticatedRequest): string {
  const headers = req.headers ?? {};
  const proto = Array.isArray(headers["x-forwarded-proto"])
    ? headers["x-forwarded-proto"][0]
    : headers["x-forwarded-proto"];
  const host = Array.isArray(headers.host) ? headers.host[0] : headers.host;
  return `${proto ?? "http"}://${host ?? "localhost:3001"}`;
}

function redirect(response: HeaderResponse, location: string): { statusCode: number; url: string } {
  response.setHeader("Location", location);
  return { statusCode: 302, url: location };
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
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): { statusCode: number; url: string } {
    const provider = parseIdpProvider(providerParam);
    return redirect(response, this.auth.buildLoginUrl(provider, requestOrigin(req)));
  }

  @Get("auth/callback")
  @HttpCode(302)
  async callback(
    @Query("provider") providerParam: string | undefined,
    @Query("code") code: string | undefined,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<{ statusCode: number; url: string }> {
    if (!code) throw new BadRequestException("code is required");
    const provider = parseIdpProvider(providerParam);
    const { token } = await this.auth.completeCallback(provider, code);
    const maxAge = this.config.get<number>("JWT_SESSION_TTL_SECONDS") ?? DEFAULT_SESSION_TTL_SECONDS;
    response.setHeader("Set-Cookie", serializeSessionCookie(token, maxAge));
    return redirect(response, "/api/me");
  }

  @Post("auth/logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: HeaderResponse): void {
    response.setHeader("Set-Cookie", serializeExpiredSessionCookie());
  }

  @Get("api/me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest): unknown {
    return req.user;
  }
}