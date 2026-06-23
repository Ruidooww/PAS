import { Inject, Injectable } from "@nestjs/common";

import type { SessionClaims } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";

interface KbDocumentAclRow {
  ragflow_doc_id: string;
}

@Injectable()
export class AclService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async computeVisibleDocIds(user: SessionClaims): Promise<string[]> {
    const scopes = this.computeVisibleScopes(user);
    const rows = await this.prisma.$queryRaw<KbDocumentAclRow[]>`
      SELECT "ragflow_doc_id"
      FROM "kb_documents"
      WHERE "acl_scope" = ANY(${scopes}::text[])
      ORDER BY "created_at" ASC, "ragflow_doc_id" ASC
    `;
    return rows.map((row) => row.ragflow_doc_id);
  }

  private computeVisibleScopes(user: SessionClaims): string[] {
    if (user.isExternal || user.role === "external") return ["public"];

    const scopes = ["public", "internal", `role:${user.role}`];
    if (user.deptId) scopes.push(`dept:${user.deptId}`);
    return scopes;
  }
}
