import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { AuthGuard } from "../../auth/auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { InternalOnlyGuard } from "../internal-only.guard";

interface AuditLogResponse {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  isExternal: boolean;
  detailJson: unknown;
  createdAt: string;
}

@Controller("api/internal/admin")
@UseGuards(AuthGuard, InternalOnlyGuard, RolesGuard)
@Roles("admin")
export class InternalAdminController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("ping")
  ping(): { ok: true } {
    return { ok: true };
  }

  @Get("audit-logs")
  async auditLogs(
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<AuditLogResponse[]> {
    const fromDate = parseOptionalDate("from", from);
    const toDate = parseOptionalDate("to", to);
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (fromDate || toDate) where.createdAt = createdAt;

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      isExternal: log.isExternal,
      detailJson: log.detailJson,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}

function parseOptionalDate(name: string, value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${name} must be an ISO date`);
  return date;
}
