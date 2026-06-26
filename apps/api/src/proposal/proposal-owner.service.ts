import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Proposal } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProposalOwnerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findOwnedProposal(
    proposalId: string,
    userId: string,
    client: Pick<Prisma.TransactionClient, "proposal"> = this.prisma,
  ): Promise<Proposal> {
    const proposal = await client.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
    });
    if (!proposal) {
      throw new NotFoundException("Proposal not found");
    }
    if (proposal.createdBy !== userId) {
      throw new ForbiddenException("Proposal owner required");
    }
    return proposal;
  }
}
