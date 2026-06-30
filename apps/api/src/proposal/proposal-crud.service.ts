import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Proposal, ProposalVersion } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

import type { SessionClaims } from "../auth/types";
import { AclService } from "../internal/acl.service";
import { FieldAclService } from "../internal/acl/field-acl.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  normalizeProposalContent,
  patchProposalSection,
  type ProposalListQuery,
  type ProposalPatch,
} from "./proposal-crud.schema";
import { ProposalOwnerService } from "./proposal-owner.service";

const PAGE_SIZE = 20;

@Injectable()
export class ProposalCrudService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AclService) private readonly acl: AclService,
    @Inject(FieldAclService) private readonly fieldAcl: FieldAclService,
    @Inject(ProposalOwnerService) private readonly owner: ProposalOwnerService,
  ) {}

  async list(query: ProposalListQuery, user: SessionClaims) {
    const visibleIds = await this.acl.computeVisibleProposalIds(user);
    const where: Prisma.ProposalWhereInput = {
      id: { in: visibleIds },
      deletedAt: null,
      ...(query.customerRef ? { customerRef: query.customerRef } : {}),
    };
    const [total, proposals] = await Promise.all([
      this.prisma.proposal.count({ where }),
      this.prisma.proposal.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      items: await Promise.all(
        proposals.map((proposal) => this.filterProposalRead(normalizeProposal(proposal), user)),
      ),
      page: query.page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  async detail(proposalId: string, user: SessionClaims) {
    return this.filterProposalRead(
      normalizeProposal(await this.owner.findOwnedProposal(proposalId, user.uid)),
      user,
    );
  }

  async patch(proposalId: string, patch: ProposalPatch, user: SessionClaims) {
    return this.prisma.$transaction(async (transaction) => {
      const proposal = await this.owner.findOwnedProposal(
        proposalId,
        user.uid,
        transaction,
      );
      if (!proposal.contentJson) {
        throw new BadRequestException("Proposal content is not available");
      }
      const contentJson = patchProposalSection(
        proposal.contentJson,
        patch.section.id,
        patch.section.body,
      );
      if (!contentJson) {
        throw new NotFoundException(`Proposal section not found: ${patch.section.id}`);
      }
      const allowedWrite = await this.fieldAcl.filterFields(
        "proposal",
        proposalId,
        { contentJson },
        user,
        "write",
      );
      if (!("contentJson" in allowedWrite)) {
        return this.filterProposalRead(normalizeProposal(proposal), user);
      }

      const data: Prisma.ProposalUpdateManyMutationInput =
        proposal.status === "final"
          ? {
              contentJson,
              status: "draft",
              version: { increment: 1 },
            }
          : { contentJson };
      const result = await transaction.proposal.updateMany({
        where: proposalRevisionWhere(proposal),
        data,
      });
      if (result.count !== 1) throw proposalConflict();

      const updated = await transaction.proposal.findUnique({
        where: { id: proposalId },
      });
      if (!updated) throw proposalConflict();
      return this.filterProposalRead(normalizeProposal(updated), user);
    });
  }

  async finalize(proposalId: string, userId: string) {
    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const proposal = await this.owner.findOwnedProposal(
          proposalId,
          userId,
          transaction,
        );
        if (!proposal.contentJson) {
          throw new BadRequestException("Proposal content is required before finalize");
        }
        if (proposal.status === "final") {
          throw new ConflictException("Proposal is already final");
        }

        const result = await transaction.proposal.updateMany({
          where: proposalRevisionWhere(proposal),
          data: { status: "final" },
        });
        if (result.count !== 1) throw proposalConflict();

        await transaction.proposalVersion.create({
          data: {
            proposalId,
            version: proposal.version,
            contentJson: proposal.contentJson as Prisma.InputJsonValue,
          },
        });
        const finalized = await transaction.proposal.findUnique({
          where: { id: proposalId },
        });
        if (!finalized) throw proposalConflict();
        return finalized;
      });
      return normalizeProposal(updated);
    } catch (error) {
      if (
        error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw proposalConflict();
      }
      throw error;
    }
  }

  async versions(proposalId: string, userId: string) {
    await this.owner.findOwnedProposal(proposalId, userId);
    const versions = await this.prisma.proposalVersion.findMany({
      where: {
        proposalId,
        proposal: {
          deletedAt: null,
          createdBy: userId,
        },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
    return versions.map(normalizeProposalVersion);
  }

  async delete(proposalId: string, userId: string) {
    await this.owner.findOwnedProposal(proposalId, userId);
    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: { deletedAt: new Date() },
    });
    return { id: proposalId, deleted: true };
  }

  private filterProposalRead(proposal: NormalizedProposal, user: SessionClaims) {
    return this.fieldAcl.filterFields(
      "proposal",
      proposal.id,
      proposal as unknown as Record<string, unknown>,
      user,
    );
  }
}

function normalizeProposal(proposal: Proposal) {
  return {
    ...proposal,
    contentJson: normalizeProposalContent(proposal.contentJson),
  };
}

type NormalizedProposal = ReturnType<typeof normalizeProposal>;

function normalizeProposalVersion(version: ProposalVersion) {
  return {
    ...version,
    contentJson: normalizeProposalContent(version.contentJson),
  };
}

function proposalRevisionWhere(proposal: Proposal): Prisma.ProposalWhereInput {
  return {
    id: proposal.id,
    version: proposal.version,
    status: proposal.status,
    deletedAt: null,
    contentJson: {
      equals: proposal.contentJson as Prisma.InputJsonValue,
    },
  };
}

function proposalConflict(): ConflictException {
  return new ConflictException("Proposal changed concurrently; retry");
}
