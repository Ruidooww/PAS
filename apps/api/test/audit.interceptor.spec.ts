import { type CallHandler, type ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { AuditInterceptor } from "../src/audit/audit.interceptor";
import type { AuditService } from "../src/audit/audit.service";
import type { SessionPayload } from "../src/auth/types";

const user: SessionPayload = {
  uid: "user-1",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "mock-user-1",
  name: "Mock User",
  email: "mock.presales@example.com",
  role: "presales",
  isExternal: false,
  deptId: "dept-presales",
  iat: 1,
  exp: 2,
};

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode: 201 }),
    }),
  } as ExecutionContext;
}

function handlerFor(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe("AuditInterceptor", () => {
  it("writes method, url, userId, and success result for authenticated requests", async () => {
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const interceptor = new AuditInterceptor(audit);

    await expect(
      lastValueFrom(
        interceptor.intercept(
          contextFor({ method: "POST", originalUrl: "/api/public/qa", user }),
          handlerFor({ answer: "ok" }),
        ),
      ),
    ).resolves.toEqual({ answer: "ok" });

    expect(audit.write).toHaveBeenCalledWith({
      action: "POST",
      resource: "/api/public/qa",
      userId: "user-1",
      isExternal: false,
      detailJson: expect.objectContaining({ result: "success" }),
    });
  });
});
