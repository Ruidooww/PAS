import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type KgEntityType, type KgRelationType } from "@prisma/client";
import type { Chunk } from "@pas/shared";
import { z } from "zod";

import { LLM_CLIENT, type LlmClient } from "../../clients/llm";
import { RAGFLOW_CLIENT, type RagflowClient } from "../../clients/ragflow";
import { runtimeConfig } from "../../config/runtime";
import { PrismaService } from "../../prisma/prisma.service";
import { KG_EXTRACT_PROMPT } from "./kg-extract.prompt";
import type { KgExtractSummary } from "./kg-extract.types";

const ENTITY_TYPES = ["product", "proposal", "customer", "industry"] as const;
const RELATION_TYPES = [
  "PRODUCT_USES",
  "CUSTOMER_BUYS",
  "PROPOSAL_FOR_CUSTOMER",
  "INDUSTRY_HAS_CUSTOMER",
  "PRODUCT_COMPETES",
] as const;

const nullableString = z.string().trim().min(1).nullable().optional();
const metadataSchema = z.record(z.unknown()).catch({});

const extractionSchema = z.object({
  entities: z
    .object({
      products: z
        .array(
          z.object({
            key: z.string().trim().min(1).optional(),
            name: z.string().trim().min(1),
            category: nullableString,
            vendor: nullableString,
            aliases: z.array(z.string().trim().min(1)).default([]),
            metadata: metadataSchema,
          }),
        )
        .default([]),
      proposals: z
        .array(
          z.object({
            key: z.string().trim().min(1).optional(),
            title: z.string().trim().min(1),
            customerKey: nullableString,
            templateId: nullableString,
            chapters: z.array(z.string().trim().min(1)).default([]),
          }),
        )
        .default([]),
      customers: z
        .array(
          z.object({
            key: z.string().trim().min(1).optional(),
            name: z.string().trim().min(1),
            industry: nullableString,
            scale: nullableString,
            crmId: nullableString,
          }),
        )
        .default([]),
      industries: z
        .array(
          z.object({
            key: z.string().trim().min(1).optional(),
            name: z.string().trim().min(1),
            code: nullableString,
            parentKey: nullableString,
          }),
        )
        .default([]),
    })
    .default({}),
  relations: z
    .array(
      z.object({
        fromType: z.enum(ENTITY_TYPES),
        fromKey: z.string().trim().min(1),
        toType: z.enum(ENTITY_TYPES),
        toKey: z.string().trim().min(1),
        relationType: z.enum(RELATION_TYPES),
        weight: z.number().min(0).max(1).optional(),
      }),
    )
    .default([]),
});

type ExtractionPayload = z.infer<typeof extractionSchema>;
type EntityType = (typeof ENTITY_TYPES)[number];

interface PersistedEntityRef {
  type: KgEntityType;
  id: string;
}

@Injectable()
export class KgExtractService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @Inject(RAGFLOW_CLIENT) private readonly ragflow: RagflowClient,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KG_EXTRACT_PROMPT) private readonly prompt: string,
  ) {}

  async extractDocument(kbDocId: string): Promise<KgExtractSummary> {
    const document = await this.prisma.kbDocument.findUnique({ where: { id: kbDocId } });
    if (!document || document.deletedAt) {
      throw new NotFoundException(`KbDocument ${kbDocId} was not found`);
    }

    const chunks = await this.ragflow.retrieve({
      kbId: document.ragflowKbId,
      query: document.name,
      topK: 20,
      docIdWhitelist: [document.ragflowDocId],
    });
    const completion = await this.llm.complete({
      messages: [
        { role: "system", content: this.prompt },
        { role: "user", content: renderDocumentForExtraction(document, chunks) },
      ],
      temperature: runtimeConfig.kg.extract.llmTemperature,
    });
    return this.persistExtraction(document, chunks, parseExtraction(completion));
  }

  async extractBatch(limit = 50): Promise<KgExtractSummary[]> {
    const documents = await this.prisma.kbDocument.findMany({
      where: { deletedAt: null },
      orderBy: { syncedAt: "desc" },
      take: limit,
    });
    const summaries: KgExtractSummary[] = [];
    for (const document of documents) {
      summaries.push(await this.extractDocument(document.id));
    }
    return summaries;
  }

  private async persistExtraction(
    document: {
      id: string;
      ragflowDocId: string;
    },
    chunks: Chunk[],
    payload: ExtractionPayload,
  ): Promise<KgExtractSummary> {
    const entityRefs = new Map<string, PersistedEntityRef>();
    const customersByKey = new Map<string, string>();
    const industriesByKey = new Map<string, string>();

    for (const industry of payload.entities.industries) {
      const row = await this.prisma.kgEntityIndustry.upsert({
        where: { name: industry.name },
        create: {
          name: industry.name,
          code: industry.code ?? null,
        },
        update: {
          code: industry.code ?? null,
        },
      });
      registerEntity(entityRefs, "industry", industry.key, industry.name, row.id);
      industriesByKey.set(entityKey("industry", industry.key ?? industry.name), row.id);
    }

    for (const industry of payload.entities.industries) {
      if (!industry.parentKey) continue;
      const id = industriesByKey.get(entityKey("industry", industry.key ?? industry.name));
      const parentId = industriesByKey.get(entityKey("industry", industry.parentKey));
      if (!id || !parentId || id === parentId) continue;
      await this.prisma.kgEntityIndustry.update({
        where: { id },
        data: { parentId },
      });
    }

    for (const customer of payload.entities.customers) {
      const row = await this.prisma.kgEntityCustomer.upsert({
        where: { name: customer.name },
        create: {
          name: customer.name,
          industry: customer.industry ?? null,
          scale: customer.scale ?? null,
          crmId: customer.crmId ?? null,
        },
        update: {
          industry: customer.industry ?? null,
          scale: customer.scale ?? null,
          crmId: customer.crmId ?? null,
        },
      });
      registerEntity(entityRefs, "customer", customer.key, customer.name, row.id);
      customersByKey.set(entityKey("customer", customer.key ?? customer.name), row.id);
    }

    for (const product of payload.entities.products) {
      const row = await this.prisma.kgEntityProduct.upsert({
        where: { name: product.name },
        create: {
          name: product.name,
          category: product.category ?? null,
          vendor: product.vendor ?? null,
          aliases: uniqueStrings(product.aliases),
          metadata: toJsonObject(product.metadata),
        },
        update: {
          category: product.category ?? null,
          vendor: product.vendor ?? null,
          aliases: uniqueStrings(product.aliases),
          metadata: toJsonObject(product.metadata),
        },
      });
      registerEntity(entityRefs, "product", product.key, product.name, row.id);
    }

    for (const proposal of payload.entities.proposals) {
      const customerId = proposal.customerKey
        ? customersByKey.get(entityKey("customer", proposal.customerKey)) ?? null
        : null;
      const row = await this.prisma.kgEntityProposal.upsert({
        where: { title: proposal.title },
        create: {
          title: proposal.title,
          customerId,
          templateId: proposal.templateId ?? null,
          chapters: uniqueStrings(proposal.chapters),
        },
        update: {
          customerId,
          templateId: proposal.templateId ?? null,
          chapters: uniqueStrings(proposal.chapters),
        },
      });
      registerEntity(entityRefs, "proposal", proposal.key, proposal.title, row.id);
    }

    const relationKeys = new Set<string>();
    let relations = 0;
    for (const relation of payload.relations) {
      const from = entityRefs.get(entityKey(relation.fromType, relation.fromKey));
      const to = entityRefs.get(entityKey(relation.toType, relation.toKey));
      if (!from || !to) continue;
      const dedupeKey = [
        from.type,
        from.id,
        to.type,
        to.id,
        relation.relationType,
      ].join("\u0000");
      if (relationKeys.has(dedupeKey)) continue;
      relationKeys.add(dedupeKey);

      const data = {
        fromEntityType: from.type,
        fromId: from.id,
        toEntityType: to.type,
        toId: to.id,
        relationType: relation.relationType as KgRelationType,
        weight: relation.weight ?? 1,
        source: {
          kbDocId: document.id,
          ragflowDocId: document.ragflowDocId,
          chunkIds: chunks.map((chunk) => chunk.id),
        },
      };
      await this.prisma.kgRelation.upsert({
        where: {
          fromEntityType_fromId_toEntityType_toId_relationType: {
            fromEntityType: data.fromEntityType,
            fromId: data.fromId,
            toEntityType: data.toEntityType,
            toId: data.toId,
            relationType: data.relationType,
          },
        },
        create: data,
        update: {
          weight: data.weight,
          source: data.source,
        },
      });
      relations += 1;
    }

    return {
      kbDocId: document.id,
      products: payload.entities.products.length,
      proposals: payload.entities.proposals.length,
      customers: payload.entities.customers.length,
      industries: payload.entities.industries.length,
      relations,
    };
  }
}

function parseExtraction(text: string): ExtractionPayload {
  return extractionSchema.parse(JSON.parse(extractJson(text)));
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function renderDocumentForExtraction(
  document: {
    id: string;
    ragflowDocId: string;
    ragflowKbId: string;
    name: string;
    product: string | null;
  },
  chunks: Chunk[],
): string {
  return [
    `KbDocument id: ${document.id}`,
    `RAGFlow doc id: ${document.ragflowDocId}`,
    `RAGFlow KB id: ${document.ragflowKbId}`,
    `Name: ${document.name}`,
    `Product hint: ${document.product ?? ""}`,
    "Chunks:",
    ...chunks.map(
      (chunk, index) =>
        `[${index + 1}] chunkId=${chunk.id} score=${Number.isFinite(chunk.score) ? chunk.score : ""}\n${chunk.content}`,
    ),
  ].join("\n\n");
}

function registerEntity(
  entityRefs: Map<string, PersistedEntityRef>,
  type: EntityType,
  key: string | undefined,
  label: string,
  id: string,
): void {
  const ref = { type, id };
  entityRefs.set(entityKey(type, label), ref);
  if (key) entityRefs.set(entityKey(type, key), ref);
}

function entityKey(type: EntityType, key: string): string {
  return `${type}:${key.trim().toLowerCase()}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export { KG_EXTRACT_PROMPT } from "./kg-extract.prompt";
