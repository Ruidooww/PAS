import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { AuthGuard } from "../../auth/auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { InternalOnlyGuard } from "../internal-only.guard";
import {
  KbSyncService,
  type KbSyncLogListResponse,
  type KbSyncRunSummary,
} from "../kb-sync/kb-sync.service";
import {
  FeedbackDashboardService,
  type FeedbackDashboardResponse,
} from "./feedback-dashboard.service";

interface AuditLogResponse {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  isExternal: boolean;
  detailJson: unknown;
  createdAt: string;
}

const optionalIsoDate = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z
    .string()
    .trim()
    .min(1)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "must be an ISO date",
    })
    .optional(),
);

const feedbackDashboardQuerySchema = z
  .object({
    from: optionalIsoDate,
    to: optionalIsoDate,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (!value.from || !value.to) return;
    if (new Date(value.from).getTime() <= new Date(value.to).getTime()) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["from"],
      message: "from must be before to",
    });
  });

const optionalQueryString = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string().trim().min(1).optional(),
);

const queryPositiveInt = (defaultValue: number, max?: number) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.coerce
      .number()
      .int()
      .positive()
      .max(max ?? Number.MAX_SAFE_INTEGER)
      .default(defaultValue),
  );

const kbSyncLogsQuerySchema = z
  .object({
    kbId: optionalQueryString,
    page: queryPositiveInt(1),
    pageSize: queryPositiveInt(20, 100),
  })
  .passthrough();

@Controller("api/internal/admin")
@UseGuards(AuthGuard, InternalOnlyGuard, RolesGuard)
@Roles("admin")
export class InternalAdminController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FeedbackDashboardService)
    private readonly feedbackDashboard: FeedbackDashboardService,
    @Inject(KbSyncService)
    private readonly kbSyncService: KbSyncService,
  ) {}

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

  @Get("feedback-dashboard")
  feedbackDashboardData(
    @Query() query: Record<string, unknown>,
  ): Promise<FeedbackDashboardResponse> {
    const parsed = feedbackDashboardQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid feedback dashboard query",
        issues: parsed.error.issues,
      });
    }
    return this.feedbackDashboard.getDashboard({
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });
  }

  @Post("kb-sync/run")
  @HttpCode(200)
  runKbSync(): Promise<KbSyncRunSummary> {
    return this.kbSyncService.runOnce({ throwOnFailure: true });
  }

  @Get("kb-sync/logs")
  kbSyncLogs(@Query() query: Record<string, unknown>): Promise<KbSyncLogListResponse> {
    const parsed = kbSyncLogsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid kb sync logs query",
        issues: parsed.error.issues,
      });
    }
    return this.kbSyncService.listLogs({
      kbId: parsed.data.kbId,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  }
}

function parseOptionalDate(name: string, value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${name} must be an ISO date`);
  return date;
}
