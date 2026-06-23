import { describe, expect, it, vi } from "vitest";

import { AuditService, type AuditEvent } from "../src/audit/audit.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const event: AuditEvent = {
  userId: "user-1",
  action: "GET",
  resource: "/api/internal/admin/ping",
  isExternal: true,
  detailJson: { result: "forbidden_external_internal" },
};

describe("AuditService", () => {
  it("logs when the Prisma auditLog delegate is missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new AuditService({} as PrismaService);

    await expect(service.write(event)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("[audit] prisma.auditLog delegate missing", { event });
    errorSpy.mockRestore();
  });

  it("logs write failures instead of throwing", async () => {
    const err = new Error("database unavailable");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new AuditService({
      auditLog: { create: vi.fn().mockRejectedValue(err) },
    } as unknown as PrismaService);

    await expect(service.write(event)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("[audit] write failed", { err, event });
    errorSpy.mockRestore();
  });
});
