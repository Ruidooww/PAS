import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

export interface AclAuditQuery {
  userId?: string;
  resourceType?: string;
  from?: Date;
  to?: Date;
}

export interface AclAuditLogResponse {
  id: string;
  userId: string | null;
  resourceType: string;
  resourceId: string;
  fieldName: string | null;
  chunkId: string | null;
  action: string;
  reason: string;
  createdAt: string;
}

@Injectable()
export class AclAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: AclAuditQuery): Promise<AclAuditLogResponse[]> {
    const where: Prisma.AclAuditLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = query.from;
      if (query.to) where.createdAt.lte = query.to;
    }

    const logs = await this.prisma.aclAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      fieldName: log.fieldName,
      chunkId: log.chunkId,
      action: log.action,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
