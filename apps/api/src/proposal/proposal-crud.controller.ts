import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import {
  proposalListQuerySchema,
  proposalPatchSchema,
} from "./proposal-crud.schema";
import { ProposalCrudService } from "./proposal-crud.service";

@Controller("api/internal/proposals")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class ProposalCrudController {
  constructor(
    @Inject(ProposalCrudService) private readonly proposals: ProposalCrudService,
  ) {}

  @Get()
  list(@Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest) {
    const parsed = proposalListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid proposal list query",
        issues: parsed.error.issues,
      });
    }
    return this.proposals.list(parsed.data, request.user!);
  }

  @Get(":id")
  detail(@Param("id") proposalId: string, @Req() request: AuthenticatedRequest) {
    return this.proposals.detail(proposalId, request.user!.uid);
  }

  @Patch(":id")
  patch(
    @Param("id") proposalId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = proposalPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid proposal patch request",
        issues: parsed.error.issues,
      });
    }
    return this.proposals.patch(proposalId, parsed.data, request.user!.uid);
  }

  @Post(":id/finalize")
  @HttpCode(200)
  finalize(@Param("id") proposalId: string, @Req() request: AuthenticatedRequest) {
    return this.proposals.finalize(proposalId, request.user!.uid);
  }

  @Get(":id/versions")
  versions(@Param("id") proposalId: string, @Req() request: AuthenticatedRequest) {
    return this.proposals.versions(proposalId, request.user!.uid);
  }

  @Delete(":id")
  delete(@Param("id") proposalId: string, @Req() request: AuthenticatedRequest) {
    return this.proposals.delete(proposalId, request.user!.uid);
  }
}
