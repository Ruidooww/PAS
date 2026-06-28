import { describe, expect, it } from "vitest";

import { AuthController } from "../src/auth/auth.controller";
import type { AuthService } from "../src/auth/auth.service";
import {
  OAUTH_STATE_COOKIE_NAME,
  serializeExpiredOAuthStateCookie,
  serializeExpiredSessionCookie,
  serializeOAuthStateCookie,
  serializeSessionCookie,
  type HeaderResponse,
} from "../src/auth/types";

function makeHeaderResponse(): { response: HeaderResponse; values: Record<string, string | string[]> } {
  const values: Record<string, string | string[]> = {};
  return {
    response: {
      setHeader(name, value) {
        values[name] = value;
      },
    },
    values,
  };
}

describe("auth cookie serialization", () => {
  it("serializes the OAuth state cookie without Secure for localhost dev callbacks", () => {
    const cookie = serializeOAuthStateCookie("state-123");

    expect(cookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=state-123`);
    expect(cookie).toContain("Max-Age=300");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("only adds Secure to session cookies when requested", () => {
    expect(serializeSessionCookie("token", 604_800, false)).not.toContain("Secure");
    expect(serializeExpiredSessionCookie(false)).not.toContain("Secure");
    expect(serializeSessionCookie("token", 604_800, true)).toContain("Secure");
    expect(serializeExpiredSessionCookie(true)).toContain("Secure");
  });

  it("expires the OAuth state cookie without Secure", () => {
    const cookie = serializeExpiredOAuthStateCookie();

    expect(cookie).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Secure");
  });

  it("does not force Secure session cookies for production HTTP deployments", () => {
    const { response, values } = makeHeaderResponse();
    const controller = new AuthController({} as AuthService, {
      get(key: string) {
        return key === "NODE_ENV" ? "production" : "http://10.0.0.12:3001";
      },
    } as never);

    controller.logout(response);

    expect(values["Set-Cookie"]).not.toContain("Secure");
  });
});
