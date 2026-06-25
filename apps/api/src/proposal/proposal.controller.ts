import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { ProposalService } from "./proposal.service";

@Controller("api/internal/proposals")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class ProposalController {
  constructor(@Inject(ProposalService) private readonly proposals: ProposalService) {}

  @Post("draft-requirement")
  @HttpCode(200)
  createDraftRequirement(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.proposals.createDraftRequirement(body, request.user!);
  }
}
