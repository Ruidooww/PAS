import { describe, expect, it } from "vitest";

import {
  OAUTH_STATE_COOKIE_NAME,
  serializeExpiredOAuthStateCookie,
  serializeExpiredSessionCookie,
  serializeOAuthStateCookie,
  serializeSessionCookie,
} from "../src/auth/types";

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
});
