import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type { ChatMessage, Chunk } from "@pas/shared";

import type { SessionClaims } from "../auth/types";
import { LLM_CLIENT, type LlmClient } from "../clients/llm";
import { RAGFLOW_CLIENT, type RagflowClient } from "../clients/ragflow";
import { runtimeConfig } from "../config/runtime";
import { AclService } from "../internal/acl.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ProposalTemplate } from "../proposal/proposal-template.schema";
import { TemplateService } from "../proposal/proposal-template.service";
import { ProposalProgressService } from "./proposal-progress.service";
import { PROPOSAL_SECTION_PROMPT } from "./proposal-section.prompt";
import type {
  GeneratedProposalSection,
  ProposalGenerationJob,
  ProposalSectionReference,
} from "./proposal-worker.types";

@Injectable()
export class ProposalGenerationService {
  private readonly logger = new Logger(ProposalGenerationService.name);

  constructor(
    @Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient,
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    @Inject(AclService) private readonly acl: AclService,
    @Inject(TemplateService) private readonly templates: TemplateService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProposalProgressService) private readonly progress: ProposalProgressService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PROPOSAL_SECTION_PROMPT) private readonly sectionPrompt: string,
  ) {}

  async generate(job: ProposalGenerationJob): Promise<void> {
    const proposal = await this.prisma.proposal.findFirst({
      where: {
        id: job.proposalId,
        deletedAt: null,
      },
      select: { status: true },
    });
    if (proposal?.status !== "draft") {
      await this.progress.publish(job.proposalId, {
        done: true,
        errorMessage: "Proposal is no longer eligible for generation result",
      });
      return;
    }

    const template = this.templates.getTemplate(job.templateId);
    const user = await this.loadUser(job.userId);
    const visibleDocIds = await this.acl.computeVisibleDocIds(user);
    const sections: GeneratedProposalSection[] = [];

    for (const [index, section] of template.sections.entries()) {
      let generated: GeneratedProposalSection;
      let errorMessage: string | undefined;
      try {
        generated = section.fixed
          ? this.renderFixedSection(section, job.requirementJson)
          : await this.generateDynamicSection(
              section,
              job.requirementJson,
              visibleDocIds,
              user,
              job.proposalId,
            );
      } catch (error) {
        errorMessage = errorMessageOf(error);
        this.logger.error(
          `Section ${section.id} generation failed for proposal ${job.proposalId}: ${errorMessage}`,
          errorStackOf(error),
        );
        generated = {
          id: section.id,
          title: section.title,
          body: "",
          refs: [],
        };
      }
      if (!section.fixed && errorMessage === undefined) {
        this.logger.log(
          `Section ${section.id} generated for proposal ${job.proposalId}: body length ${generated.body.length}`,
        );
      }
      sections.push(generated);
      await this.progress.publish(job.proposalId, {
        chapter: section.id,
        n: index + 1,
        total: template.sections.length,
        ...(errorMessage === undefined ? {} : { errorMessage }),
      });
    }

    const result = await this.prisma.proposal.updateMany({
      where: {
        id: job.proposalId,
        deletedAt: null,
        status: "draft",
      },
      data: {
        contentJson: {
          sections,
        } as unknown as Prisma.InputJsonValue,
        status: "draft_ready",
      },
    });
    if (result.count === 0) {
      await this.progress.publish(job.proposalId, {
        done: true,
        errorMessage: "Proposal is no longer eligible for generation result",
      });
      return;
    }
    await this.progress.publish(job.proposalId, { done: true });
  }

  private renderFixedSection(
    section: ProposalTemplate["sections"][number],
    requirementJson: Prisma.JsonValue,
  ): GeneratedProposalSection {
    return {
      id: section.id,
      title: section.title,
      body: renderTemplate(section.promptTemplate, requirementJson),
      refs: [],
    };
  }

  private async generateDynamicSection(
    section: ProposalTemplate["sections"][number],
    requirementJson: Prisma.JsonValue,
    visibleDocIds: string[],
    user: SessionClaims,
    proposalId: string,
  ): Promise<GeneratedProposalSection> {
    let lastError: unknown;
    const maxAttempts = runtimeConfig.proposal.chapterRetries + 1;

    for (let attempt = 0; attempt <= runtimeConfig.proposal.chapterRetries; attempt += 1) {
      try {
        const chunks = await this.retrieveVisibleChunks(
          section,
          requirementJson,
          visibleDocIds,
          user,
        );
        const body = await this.llmClient.complete({
          messages: this.buildMessages(section, requirementJson, chunks),
          temperature: runtimeConfig.llm.proposalSection.temperature,
        });
        return {
          id: section.id,
          title: section.title,
          body,
          refs: citedReferences(body, chunks),
        };
      } catch (error) {
        lastError = error;
        const attemptNumber = attempt + 1;
        this.logger.error(
          `Section ${section.id} attempt ${attemptNumber}/${maxAttempts} failed for proposal ${proposalId}: ${errorMessageOf(error)}`,
          errorStackOf(error),
        );
      }
    }

    throw lastError;
  }

  private async retrieveVisibleChunks(
    section: ProposalTemplate["sections"][number],
    requirementJson: Prisma.JsonValue,
    visibleDocIds: string[],
    user: SessionClaims,
  ): Promise<Chunk[]> {
    if (visibleDocIds.length === 0) return [];
    const chunks = await this.ragflowClient.retrieve(
      {
        query: `${renderTemplate(section.retrievalIntent, requirementJson)} ${requirementKeywords(
          requirementJson,
        )}`.trim(),
        kbId: this.config.getOrThrow<string>("PAS_KB_ID"),
        topK: runtimeConfig.proposal.retrievalTopK,
        docIdWhitelist: visibleDocIds,
      },
      user,
    );
    const allowedDocIds = new Set(visibleDocIds);
    return chunks.filter((chunk) => allowedDocIds.has(chunk.documentId));
  }

  private buildMessages(
    section: ProposalTemplate["sections"][number],
    requirementJson: Prisma.JsonValue,
    chunks: Chunk[],
  ): ChatMessage[] {
    const knowledge = chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
      .join("\n\n");
    return [
      { role: "system", content: this.sectionPrompt },
      {
        role: "user",
        content: [
          `章节：${section.title}`,
          `写作要求：${renderTemplate(section.promptTemplate, requirementJson)}`,
          `需求：${JSON.stringify(requirementJson)}`,
          `知识片段：\n${knowledge || "[无可见知识片段]"}`,
        ].join("\n\n"),
      },
    ];
  }

  private async loadUser(userId: string): Promise<SessionClaims> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        idpProvider: true,
        idpUserId: true,
        name: true,
        email: true,
        role: true,
        isExternal: true,
        deptId: true,
      },
    });
    if (!user) throw new Error(`Proposal generation user not found: ${userId}`);
    return {
      uid: user.id,
      tenantId: user.tenantId,
      idpProvider: user.idpProvider,
      idpUserId: user.idpUserId,
      name: user.name,
      email: user.email,
      role: user.role,
      isExternal: user.isExternal,
      deptId: user.deptId,
    };
  }
}

function renderTemplate(template: string, requirementJson: Prisma.JsonValue): string {
  const requirement = asRecord(requirementJson);
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (key === "requirementJson") return JSON.stringify(requirementJson);
    if (key === "requirementJson.needs[]" || key === "need") {
      return stringArray(requirement.needs).join("、");
    }
    const value = requirement[key];
    if (Array.isArray(value)) return value.map(String).join("、");
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

function requirementKeywords(requirementJson: Prisma.JsonValue): string {
  return JSON.stringify(requirementJson);
}

function asRecord(value: Prisma.JsonValue): Prisma.JsonObject {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value;
}

function stringArray(value: Prisma.JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function citedReferences(body: string, chunks: Chunk[]): ProposalSectionReference[] {
  const cited = new Set<number>();
  for (const match of body.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= chunks.length) cited.add(n);
  }
  return [...cited]
    .sort((left, right) => left - right)
    .map((n) => referenceFromChunk(n, chunks[n - 1]!));
}

function referenceFromChunk(n: number, chunk: Chunk): ProposalSectionReference {
  const docName = firstString(
    chunk.metadata.docName,
    chunk.metadata.documentName,
    chunk.metadata.documentKeyword,
    chunk.documentId,
  );
  const page = numberValue(chunk.metadata.page);
  return {
    n,
    chunkId: chunk.id,
    docName,
    ...(page === undefined ? {} : { page }),
  };
}

function firstString(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string") ?? "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStackOf(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
