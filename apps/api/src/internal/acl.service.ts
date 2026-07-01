import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { SessionClaims } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";

interface KbDocumentAclRow {
  ragflow_doc_id: string;
}

@Injectable()
export class AclService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async computeVisibleDocIds(user: SessionClaims, ragflowKbId?: string): Promise<string[]> {
    const scopes = this.computeVisibleScopes(user);
    const kbFilter =
      ragflowKbId === undefined
        ? Prisma.empty
        : Prisma.sql`AND "ragflow_kb_id" = ${ragflowKbId}`;
    const rows = await this.prisma.$queryRaw<KbDocumentAclRow[]>`
      SELECT "ragflow_doc_id"
      FROM "kb_documents"
      WHERE "deleted_at" IS NULL
        AND "acl_scope" = ANY(${scopes}::text[])
        ${kbFilter}
      ORDER BY "created_at" ASC, "ragflow_doc_id" ASC
    `;
    return rows.map((row) => row.ragflow_doc_id);
  }

  async computeVisibleProposalIds(user: SessionClaims): Promise<string[]> {
    const ownerOrDepartment: Prisma.ProposalWhereInput[] = [{ createdBy: user.uid }];
    if (user.deptId) {
      ownerOrDepartment.push({
        creator: { tenantId: user.tenantId, deptId: user.deptId },
      });
    }

    const rows = await this.prisma.proposal.findMany({
      where: {
        deletedAt: null,
        OR: ownerOrDepartment,
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => row.id);
  }

  private computeVisibleScopes(user: SessionClaims): string[] {
    if (user.isExternal || user.role === "external") return ["public"];

    const scopes = ["public", "internal", `role:${user.role}`];
    if (user.deptId) scopes.push(`dept:${user.deptId}`);
    return scopes;
  }
}
