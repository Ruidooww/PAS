import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
} from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { AuditInterceptor } from "../src/audit/audit.interceptor";
import type { AuditService } from "../src/audit/audit.service";
import type { SessionPayload } from "../src/auth/types";
import { InternalOnlyForbiddenException } from "../src/internal/internal-only.exception";

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

function errorHandler(error: unknown): CallHandler {
  return { handle: () => throwError(() => error) };
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

  it("skips generic error audit for InternalOnlyGuard external denials", async () => {
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const interceptor = new AuditInterceptor(audit);
    const error = new InternalOnlyForbiddenException();

    await expect(
      lastValueFrom(
        interceptor.intercept(
          contextFor({ method: "GET", originalUrl: "/api/internal/admin/ping", user }),
          errorHandler(error),
        ),
      ),
    ).rejects.toBe(error);

    expect(audit.write).not.toHaveBeenCalled();
  });

  it("still writes audit records for non-internal-only errors", async () => {
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const interceptor = new AuditInterceptor(audit);
    const error = new BadRequestException("invalid query");

    await expect(
      lastValueFrom(
        interceptor.intercept(
          contextFor({ method: "GET", originalUrl: "/api/internal/admin/audit-logs", user }),
          errorHandler(error),
        ),
      ),
    ).rejects.toBe(error);

    expect(audit.write).toHaveBeenCalledWith({
      action: "GET",
      resource: "/api/internal/admin/audit-logs",
      userId: "user-1",
      isExternal: false,
      detailJson: expect.objectContaining({ result: "error", statusCode: 400 }),
    });
  });
});
