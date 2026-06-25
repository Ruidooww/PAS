import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { AuthGuard } from "../../auth/auth.guard";
import type { AuthenticatedRequest } from "../../auth/types";
import { InternalOnlyGuard } from "../../internal/internal-only.guard";
import {
  ProposalExportService,
  type ProposalExportFormat,
} from "./proposal-export.service";

const exportQuerySchema = z
  .object({
    format: z.enum(["md", "docx"]),
  })
  .strict();

@Controller("api/internal/proposals")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class ProposalExportController {
  constructor(
    @Inject(ProposalExportService) private readonly exporter: ProposalExportService,
  ) {}

  @Get(":id/export")
  @Header("Cache-Control", "no-store")
  async export(
    @Param("id") proposalId: string,
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const parsed = exportQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid proposal export query",
        issues: parsed.error.issues,
      });
    }
    const format: ProposalExportFormat = parsed.data.format;
    const result = await this.exporter.export(proposalId, request.user!.uid, format);
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: result.contentDisposition,
      length: result.buffer.length,
    });
  }
}
