import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ChatMessage } from "@pas/shared";

import type { SessionClaims } from "../auth/types";
import { LLM_CLIENT, type LlmClient } from "../clients/llm";
import { PrismaService } from "../prisma/prisma.service";
import { PROPOSAL_PROMPT } from "./proposal.prompt";
import {
  type DraftRequirementRequest,
  draftRequirementRequestSchema,
  llmRequirementSchema,
  type Requirement,
  requirementSchema,
} from "./proposal.schema";

@Injectable()
export class ProposalService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PROPOSAL_PROMPT) private readonly prompt: string,
  ) {}

  async createDraftRequirement(body: unknown, user: SessionClaims) {
    const request = this.parseRequest(body);
    const requirement = request.freeText
      ? await this.completeRequirement(request)
      : this.buildRequirement(request);

    return this.prisma.proposal.create({
      data: {
        customerRef: requirement.customer,
        title: `${requirement.customer}需求方案`,
        status: "draft",
        requirementJson: requirement as Prisma.InputJsonValue,
        createdBy: user.uid,
      },
    });
  }

  private parseRequest(body: unknown): DraftRequirementRequest {
    const parsed = draftRequirementRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid proposal requirement request",
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  private buildRequirement(request: DraftRequirementRequest): Requirement {
    const parsed = requirementSchema.safeParse({
      customer: request.formFields.customerName,
      industry: request.formFields.industry,
      scale: request.formFields.scale,
      needs: request.formFields.needs,
      constraints: request.formFields.constraints,
    });
    if (!parsed.success) {
      throw new BadRequestException({
        message: "formFields do not contain a complete requirement",
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  private async completeRequirement(request: DraftRequirementRequest): Promise<Requirement> {
    const messages: ChatMessage[] = [
      { role: "system", content: this.prompt },
      {
        role: "user",
        content: JSON.stringify({
          freeText: request.freeText,
          formFields: request.formFields,
        }),
      },
    ];
    let rawOutput = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      rawOutput = await this.llmClient.complete({ messages, temperature: 0 });
      const requirement = parseLlmRequirement(rawOutput);
      if (requirement) {
        return requirementSchema.parse({
          customer: request.formFields.customerName || requirement.customer,
          industry: request.formFields.industry || requirement.industry,
          scale: request.formFields.scale || requirement.scale,
          needs:
            request.formFields.needs.length > 0
              ? request.formFields.needs
              : requirement.needs,
          constraints:
            request.formFields.constraints.length > 0
              ? request.formFields.constraints
              : requirement.constraints,
        });
      }
    }

    throw new UnprocessableEntityException({
      message: "LLM output failed requirement validation",
      rawOutput,
    });
  }
}

function parseLlmRequirement(rawOutput: string): Requirement | undefined {
  try {
    const parsed = llmRequirementSchema.safeParse(JSON.parse(rawOutput));
    return parsed.success ? parsed.data.requirement_json : undefined;
  } catch {
    return undefined;
  }
}
