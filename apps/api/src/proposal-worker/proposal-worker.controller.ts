import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { ProposalOwnerService } from "../proposal/proposal-owner.service";
import { ProposalGenerationQueue } from "./proposal-generation.queue";
import { ProposalProgressService } from "./proposal-progress.service";

const generationRequestSchema = z
  .object({
    templateId: z.string().trim().min(1),
  })
  .strict();

@Controller("api/internal/proposals")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class ProposalWorkerController {
  constructor(
    @Inject(ProposalOwnerService) private readonly owner: ProposalOwnerService,
    @Inject(ProposalGenerationQueue) private readonly queue: ProposalGenerationQueue,
    @Inject(ProposalProgressService) private readonly progress: ProposalProgressService,
  ) {}

  @Post(":id/generate")
  @HttpCode(202)
  async generate(
    @Param("id") proposalId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedBody = generationRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException({
        message: "Invalid proposal generation request",
        issues: parsedBody.error.issues,
      });
    }
    const proposal = await this.owner.findOwnedProposal(proposalId, request.user!.uid);
    if (proposal.status === "final") {
      throw new ConflictException(
        "Proposal is finalized; PATCH a section first to fork a new draft version",
      );
    }
    const { templateId } = parsedBody.data;
    await this.queue.enqueue({
      proposalId,
      requirementJson: proposal.requirementJson,
      templateId,
      userId: request.user!.uid,
    });
    return { proposalId, status: "queued" };
  }

  @Get(":id/progress")
  @Sse()
  async streamProgress(
    @Param("id") proposalId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.owner.findOwnedProposal(proposalId, request.user!.uid);
    return this.progress.stream(proposalId);
  }
}
