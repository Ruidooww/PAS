import { describe, expect, it, vi } from "vitest";

import { AclService } from "../src/internal/acl.service";
import type { SessionClaims } from "../src/auth/types";
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

describe("AclService", () => {
  it("only exposes public documents to external users", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ ragflow_doc_id: "doc-public" }]);
    const service = new AclService({ $queryRaw: queryRaw } as unknown as PrismaService);

    await expect(
      service.computeVisibleDocIds(user({ role: "external", isExternal: true, deptId: null })),
    ).resolves.toEqual(["doc-public"]);

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(String(queryRaw.mock.calls[0]?.[0])).toContain("acl_scope");
    expect(queryRaw.mock.calls[0]).toContainEqual(["public"]);
  });

  it("exposes public, internal, matching role, and matching dept documents to internal users", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      { ragflow_doc_id: "doc-public" },
      { ragflow_doc_id: "doc-internal" },
      { ragflow_doc_id: "doc-role" },
      { ragflow_doc_id: "doc-dept" },
    ]);
    const service = new AclService({ $queryRaw: queryRaw } as unknown as PrismaService);

    await expect(service.computeVisibleDocIds(user())).resolves.toEqual([
      "doc-public",
      "doc-internal",
      "doc-role",
      "doc-dept",
    ]);

    expect(queryRaw.mock.calls[0]).toContainEqual([
      "public",
      "internal",
      "role:presales",
      "dept:dept-presales",
    ]);
  });
});
