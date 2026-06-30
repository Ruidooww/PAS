import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { AuthGuard } from "../../auth/auth.guard";
import type { AuthenticatedRequest } from "../../auth/types";
import { InternalOnlyGuard } from "../internal-only.guard";
import { AclAuditService } from "./acl-audit.service";

const optionalQueryString = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string().trim().min(1).optional(),
);

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

const aclAuditQuerySchema = z
  .object({
    userId: optionalQueryString,
    resourceType: optionalQueryString,
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

@Controller("api/internal/acl")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class AclAuditController {
  constructor(@Inject(AclAuditService) private readonly audit: AclAuditService) {}

  @Get("audit")
  list(@Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    const role = String(request.user?.role ?? "");
    if (role !== "admin" && role !== "compliance") {
      throw new ForbiddenException("Insufficient role");
    }

    const parsed = aclAuditQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid ACL audit query",
        issues: parsed.error.issues,
      });
    }
    return this.audit.list({
      userId: parsed.data.userId,
      resourceType: parsed.data.resourceType,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });
  }
}
