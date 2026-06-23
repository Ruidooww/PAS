import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

export interface AuditEvent {
  userId?: string | null;
  action: string;
  resource: string;
  isExternal: boolean;
  detailJson: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async write(event: AuditEvent): Promise<void> {
    const auditLog = this.prisma.auditLog;
    if (!auditLog?.create) {
      console.error("[audit] prisma.auditLog delegate missing", { event });
      return;
    }
    try {
      await auditLog.create({
        data: {
          userId: event.userId ?? null,
          action: event.action,
          resource: event.resource,
          isExternal: event.isExternal,
          detailJson: event.detailJson as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error("[audit] write failed", { err, event });
    }
  }
}
