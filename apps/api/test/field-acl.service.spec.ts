import { describe, expect, it, vi } from "vitest";

import type { SessionClaims } from "../src/auth/types";
import { FieldAclService } from "../src/internal/acl/field-acl.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function user(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    uid: "user-1",
    tenantId: "tenant-default",
    idpProvider: "mock",
    idpUserId: "mock-user-1",
    name: "Mock User",
    email: "mock.presales@example.com",
    role: "presales",
    isExternal: false,
    deptId: "dept-presales",
    ...overrides,
  };
}

function serviceWith(rows: unknown[]) {
  const fieldAclFindMany = vi.fn().mockResolvedValue(rows);
  const aclAuditLogCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const service = new FieldAclService({
    fieldAcl: { findMany: fieldAclFindMany },
    aclAuditLog: { createMany: aclAuditLogCreateMany },
  } as unknown as PrismaService);
  return { service, fieldAclFindMany, aclAuditLogCreateMany };
}

describe("FieldAclService", () => {
  it("filters denied read fields and records an audit log without field values", async () => {
    const { service, fieldAclFindMany, aclAuditLogCreateMany } = serviceWith([
      {
        resourceType: "customer",
        resourceId: "cust-acme",
        fieldName: "email",
        requiredRoles: ["admin"],
        requiredAttrs: {},
      },
      {
        resourceType: "customer",
        resourceId: "cust-acme",
        fieldName: "scale",
        requiredRoles: [],
        requiredAttrs: { user: { dept: "dept-presales" } },
      },
    ]);

    const filtered = await service.filterFields(
      "customer",
      "cust-acme",
      { name: "Acme", email: "buyer@example.com", scale: 1200 },
      user(),
    );

    expect(filtered).toEqual({ name: "Acme", scale: 1200 });
    expect(fieldAclFindMany).toHaveBeenCalledWith({
      where: {
        resourceType: "customer",
        resourceId: { in: ["cust-acme", "*"] },
        fieldName: { in: ["name", "email", "scale"] },
      },
      orderBy: [{ resourceId: "desc" }, { createdAt: "desc" }],
    });
    expect(aclAuditLogCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          resourceType: "customer",
          resourceId: "cust-acme",
          fieldName: "email",
          action: "field_read_filter",
          reason: "required_roles_denied",
        },
      ],
    });
    expect(JSON.stringify(aclAuditLogCreateMany.mock.calls)).not.toContain(
      "buyer@example.com",
    );
  });

  it("silently removes denied write fields from the payload", async () => {
    const { service, aclAuditLogCreateMany } = serviceWith([
      {
        resourceType: "proposal",
        resourceId: "proposal-1",
        fieldName: "contentJson",
        requiredRoles: ["admin"],
        requiredAttrs: {},
      },
    ]);

    const filtered = await service.filterFields(
      "proposal",
      "proposal-1",
      { title: "Allowed title", contentJson: { sections: [] } },
      user(),
      "write",
    );

    expect(filtered).toEqual({ title: "Allowed title" });
    expect(aclAuditLogCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          fieldName: "contentJson",
          action: "field_write_filter",
          reason: "required_roles_denied",
        }),
      ],
    });
  });
});
