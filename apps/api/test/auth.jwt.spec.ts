import { describe, expect, it } from "vitest";

import { JwtSessionService } from "../src/auth/jwt-session.service";

describe("JwtSessionService", () => {
  it("signs and verifies a PAS session JWT", () => {
    const service = new JwtSessionService("test-secret-at-least-32-characters-long", 604_800);

    const token = service.sign({
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

    expect(service.verify(token)).toMatchObject({
      uid: "user-1",
      tenantId: "tenant-1",
      idpProvider: "mock",
      role: "presales",
      isExternal: false,
      deptId: "dept-presales",
    });
  });

  it("rejects tampered tokens", () => {
    const service = new JwtSessionService("test-secret-at-least-32-characters-long", 604_800);
    const token = service.sign({
      uid: "user-1",
      tenantId: "tenant-1",
      idpProvider: "mock",
      idpUserId: "mock-user-1",
      name: "Mock 售前",
      email: null,
      role: "presales",
      isExternal: false,
      deptId: null,
    });

    expect(() => service.verify(`${token.slice(0, -1)}x`)).toThrow(/Invalid session token/);
  });
});
