import { describe, expect, it, vi } from "vitest";

import { JwtAuthMiddleware } from "../src/auth/jwt-auth.middleware";
import { JwtSessionService } from "../src/auth/jwt-session.service";

describe("JwtAuthMiddleware", () => {
  it("injects req.user from the HttpOnly session cookie", () => {
    const jwt = new JwtSessionService("test-secret-at-least-32-characters-long", 604_800);
    const token = jwt.sign({
      uid: "user-1",
      tenantId: "tenant-1",
      idpProvider: "mock",
      idpUserId: "mock-user-1",
      name: "Mock 售前",
      email: "mock.presales@example.com",
      role: "presales",
      isExternal: false,
      deptId: "dept-presales",
    });
    const middleware = new JwtAuthMiddleware(jwt);
    const req = { headers: { cookie: `other=x; pas_session=${token}` } };
    const next = vi.fn();

    middleware.use(req, {}, next);

    expect(req).toHaveProperty("user", expect.objectContaining({ uid: "user-1" }));
    expect(next).toHaveBeenCalledOnce();
  });
});
