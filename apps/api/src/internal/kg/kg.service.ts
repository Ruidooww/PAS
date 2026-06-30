import { Inject, Injectable } from "@nestjs/common";
import type { KgEntityType, KgRelationType } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

export const KG_ENTITY_TYPES = ["product", "proposal", "customer", "industry"] as const;
export const KG_RELATION_TYPES = [
  "PRODUCT_USES",
  "CUSTOMER_BUYS",
  "PROPOSAL_FOR_CUSTOMER",
  "INDUSTRY_HAS_CUSTOMER",
  "PRODUCT_COMPETES",
] as const;

export type KgEntityTypeValue = (typeof KG_ENTITY_TYPES)[number];
export type KgRelationTypeValue = (typeof KG_RELATION_TYPES)[number];

export interface KgEntityDto {
  type: KgEntityTypeValue;
  id: string;
  label: string;
  data: Record<string, unknown>;
}

export interface KgRelatedDto {
  relationType: KgRelationTypeValue;
  direction: "in" | "out";
  weight: number;
  source: unknown;
  entity: KgEntityDto;
}

export interface KgPathDto {
  nodes: KgEntityDto[];
  edges: Array<{
    fromEntityType: KgEntityTypeValue;
    fromId: string;
    toEntityType: KgEntityTypeValue;
    toId: string;
    relationType: KgRelationTypeValue;
    weight: number;
    source: unknown;
  }>;
}

type RelationRow = {
  fromEntityType: KgEntityType;
  fromId: string;
  toEntityType: KgEntityType;
  toId: string;
  relationType: KgRelationType;
  weight: number;
  source: unknown;
};

@Injectable()
export class KgService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findEntities(params: {
    type: KgEntityTypeValue;
    q?: string;
  }): Promise<KgEntityDto[]> {
    const q = params.q?.trim();
    const rows = await this.findRows(params.type, q ? this.searchWhere(params.type, q) : {});
    return rows.map((row) => this.toEntityDto(params.type, row));
  }

  async related(
    id: string,
    params: { relationType?: KgRelationTypeValue; depth?: number },
  ): Promise<KgRelatedDto[]> {
    const depth = Math.min(Math.max(params.depth ?? 1, 1), 3);
    const relations = await this.loadRelations(params.relationType);
    const output: KgRelatedDto[] = [];
    const visited = new Set([id]);
    let frontier = new Set([id]);

    for (let level = 0; level < depth; level += 1) {
      const next = new Set<string>();
      for (const relation of relations) {
        const fromCurrent = frontier.has(relation.fromId);
        const toCurrent = frontier.has(relation.toId);
        if (!fromCurrent && !toCurrent) continue;
        const neighborId = fromCurrent ? relation.toId : relation.fromId;
        const neighborType = fromCurrent ? relation.toEntityType : relation.fromEntityType;
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        next.add(neighborId);
        const entity = await this.findEntityByType(neighborType, neighborId);
        if (!entity) continue;
        output.push({
          relationType: relation.relationType,
          direction: fromCurrent ? "out" : "in",
          weight: relation.weight,
          source: relation.source,
          entity,
        });
      }
      frontier = next;
      if (frontier.size === 0) break;
    }

    return output;
  }

  async findPath(from: string, to: string): Promise<KgPathDto> {
    if (from === to) {
      const entity = await this.findEntityById(from);
      return entity ? { nodes: [entity], edges: [] } : { nodes: [], edges: [] };
    }
    const relations = await this.loadRelations();
    const queue: Array<{ id: string; path: RelationRow[] }> = [{ id: from, path: [] }];
    const visited = new Set([from]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (current.path.length >= 3) continue;
      for (const relation of relations) {
        const neighborId =
          relation.fromId === current.id
            ? relation.toId
            : relation.toId === current.id
              ? relation.fromId
              : undefined;
        if (!neighborId || visited.has(neighborId)) continue;
        const nextPath = [...current.path, relation];
        if (neighborId === to) {
          return this.toPathDto(from, to, nextPath);
        }
        visited.add(neighborId);
        queue.push({ id: neighborId, path: nextPath });
      }
    }

    return { nodes: [], edges: [] };
  }

  private async toPathDto(from: string, to: string, relations: RelationRow[]): Promise<KgPathDto> {
    const orderedIds = [from];
    let currentId = from;
    for (const relation of relations) {
      const nextId = relation.fromId === currentId ? relation.toId : relation.fromId;
      orderedIds.push(nextId);
      currentId = nextId;
    }
    if (orderedIds[orderedIds.length - 1] !== to) return { nodes: [], edges: [] };
    const nodes = await Promise.all(orderedIds.map((id) => this.findEntityById(id)));
    if (nodes.some((node) => !node)) return { nodes: [], edges: [] };
    return {
      nodes: nodes as KgEntityDto[],
      edges: relations.map((relation) => ({
        fromEntityType: relation.fromEntityType,
        fromId: relation.fromId,
        toEntityType: relation.toEntityType,
        toId: relation.toId,
        relationType: relation.relationType,
        weight: relation.weight,
        source: relation.source,
      })),
    };
  }

  private loadRelations(relationType?: KgRelationTypeValue): Promise<RelationRow[]> {
    return this.prisma.kgRelation.findMany({
      where: relationType ? { relationType } : {},
    }) as Promise<RelationRow[]>;
  }

  private async findEntityById(id: string): Promise<KgEntityDto | null> {
    for (const type of KG_ENTITY_TYPES) {
      const entity = await this.findEntityByType(type, id);
      if (entity) return entity;
    }
    return null;
  }

  private async findEntityByType(
    type: KgEntityTypeValue,
    id: string,
  ): Promise<KgEntityDto | null> {
    const row = await this.findUniqueRow(type, id);
    return row ? this.toEntityDto(type, row) : null;
  }

  private async findRows(
    type: KgEntityTypeValue,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    if (type === "product") {
      return this.prisma.kgEntityProduct.findMany({
        where,
        take: 20,
        orderBy: { name: "asc" },
      }) as unknown as Record<string, unknown>[];
    }
    if (type === "proposal") {
      return this.prisma.kgEntityProposal.findMany({
        where,
        take: 20,
        orderBy: { title: "asc" },
      }) as unknown as Record<string, unknown>[];
    }
    if (type === "customer") {
      return this.prisma.kgEntityCustomer.findMany({
        where,
        take: 20,
        orderBy: { name: "asc" },
      }) as unknown as Record<string, unknown>[];
    }
    return this.prisma.kgEntityIndustry.findMany({
      where,
      take: 20,
      orderBy: { name: "asc" },
    }) as unknown as Record<string, unknown>[];
  }

  private async findUniqueRow(
    type: KgEntityTypeValue,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    if (type === "product") {
      return this.prisma.kgEntityProduct.findUnique({ where: { id } }) as Promise<
        Record<string, unknown> | null
      >;
    }
    if (type === "proposal") {
      return this.prisma.kgEntityProposal.findUnique({ where: { id } }) as Promise<
        Record<string, unknown> | null
      >;
    }
    if (type === "customer") {
      return this.prisma.kgEntityCustomer.findUnique({ where: { id } }) as Promise<
        Record<string, unknown> | null
      >;
    }
    return this.prisma.kgEntityIndustry.findUnique({ where: { id } }) as Promise<
      Record<string, unknown> | null
    >;
  }

  private searchWhere(type: KgEntityTypeValue, q: string): Record<string, unknown> {
    if (type === "product") {
      return {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { aliases: { has: q } },
        ],
      };
    }
    if (type === "proposal") {
      return { title: { contains: q, mode: "insensitive" } };
    }
    return { name: { contains: q, mode: "insensitive" } };
  }

  private toEntityDto(type: KgEntityTypeValue, row: Record<string, unknown>): KgEntityDto {
    if (type === "proposal") {
      return {
        type,
        id: row.id as string,
        label: row.title as string,
        data: {
          customerId: row.customerId ?? null,
          templateId: row.templateId ?? null,
          chapters: row.chapters ?? [],
        },
      };
    }
    if (type === "product") {
      return {
        type,
        id: row.id as string,
        label: row.name as string,
        data: {
          category: row.category ?? null,
          vendor: row.vendor ?? null,
          aliases: row.aliases ?? [],
          metadata: row.metadata ?? {},
        },
      };
    }
    if (type === "customer") {
      return {
        type,
        id: row.id as string,
        label: row.name as string,
        data: {
          industry: row.industry ?? null,
          scale: row.scale ?? null,
          crmId: row.crmId ?? null,
        },
      };
    }
    return {
      type,
      id: row.id as string,
      label: row.name as string,
      data: {
        code: row.code ?? null,
        parentId: row.parentId ?? null,
      },
    };
  }
}
