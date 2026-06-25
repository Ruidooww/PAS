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

  it("returns undeleted proposals owned by the user or created in the same tenant department", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "proposal-own" },
      { id: "proposal-dept" },
    ]);
    const service = new AclService({
      proposal: { findMany },
    } as unknown as PrismaService);

    await expect(service.computeVisibleProposalIds(user())).resolves.toEqual([
      "proposal-own",
      "proposal-dept",
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { createdBy: "user-1" },
          { creator: { tenantId: "tenant-default", deptId: "dept-presales" } },
        ],
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("does not include proposals from another tenant that happens to share the dept id", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new AclService({
      proposal: { findMany },
    } as unknown as PrismaService);

    await service.computeVisibleProposalIds(
      user({ tenantId: "tenant-acme", deptId: "dept-shared" }),
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { createdBy: "user-1" },
          { creator: { tenantId: "tenant-acme", deptId: "dept-shared" } },
        ],
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("only returns owned proposals when the user has no department", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "proposal-own" }]);
    const service = new AclService({
      proposal: { findMany },
    } as unknown as PrismaService);

    await expect(
      service.computeVisibleProposalIds(user({ deptId: null })),
    ).resolves.toEqual(["proposal-own"]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [{ createdBy: "user-1" }],
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });
});
