import { describe, expect, it, vi } from "vitest";

import { KgService } from "../src/internal/kg/kg.service";

describe("KgService", () => {
  it("finds product entities by fuzzy name and alias", async () => {
    const prisma = createPrisma();
    const service = new KgService(prisma as never);

    await expect(service.findEntities({ type: "product", q: "ipg" })).resolves.toEqual([
      {
        type: "product",
        id: "product-1",
        label: "IP-Guard",
        data: expect.objectContaining({ vendor: "HYYA" }),
      },
    ]);
    expect(prisma.kgEntityProduct.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "ipg", mode: "insensitive" } },
          { aliases: { has: "ipg" } },
        ],
      },
      take: 20,
      orderBy: { name: "asc" },
    });
  });

  it("returns one-hop related incoming and outgoing neighbors filtered by relation type", async () => {
    const prisma = createPrisma();
    const service = new KgService(prisma as never);

    await expect(
      service.related("product-1", { relationType: "CUSTOMER_BUYS", depth: 1 }),
    ).resolves.toEqual([
      {
        relationType: "CUSTOMER_BUYS",
        direction: "in",
        weight: 0.9,
        source: { kbDocId: "kbdoc-1" },
        entity: {
          type: "customer",
          id: "customer-1",
          label: "ABC Bank",
          data: expect.objectContaining({ industry: "Finance" }),
        },
      },
    ]);
  });

  it("finds the shortest path but does not traverse beyond three hops", async () => {
    const prisma = createPrisma();
    const service = new KgService(prisma as never);

    await expect(service.findPath("product-1", "industry-1")).resolves.toEqual({
      nodes: [
        { type: "product", id: "product-1", label: "IP-Guard", data: expect.any(Object) },
        { type: "customer", id: "customer-1", label: "ABC Bank", data: expect.any(Object) },
        { type: "industry", id: "industry-1", label: "Finance", data: expect.any(Object) },
      ],
      edges: [
        expect.objectContaining({ relationType: "CUSTOMER_BUYS" }),
        expect.objectContaining({ relationType: "INDUSTRY_HAS_CUSTOMER" }),
      ],
    });
    await expect(service.findPath("product-1", "industry-4")).resolves.toEqual({
      nodes: [],
      edges: [],
    });
  });
});

function createPrisma() {
  const products = [
    {
      id: "product-1",
      name: "IP-Guard",
      category: "DLP",
      vendor: "HYYA",
      aliases: ["ipg"],
      metadata: {},
    },
  ];
  const customers = [
    {
      id: "customer-1",
      name: "ABC Bank",
      industry: "Finance",
      scale: "large",
      crmId: "crm-abc",
    },
  ];
  const industries = [
    { id: "industry-1", name: "Finance", code: "FIN", parentId: null },
    { id: "industry-2", name: "Banking", code: "BANK", parentId: "industry-1" },
    { id: "industry-3", name: "Retail Banking", code: "RBANK", parentId: "industry-2" },
    { id: "industry-4", name: "Private Banking", code: "PBANK", parentId: "industry-3" },
  ];
  const proposals = [
    {
      id: "proposal-1",
      title: "Finance DLP proposal",
      customerId: "customer-1",
      templateId: "ip-guard-standard-v1",
      chapters: ["背景", "方案"],
    },
  ];
  const relations = [
    relation("customer", "customer-1", "product", "product-1", "CUSTOMER_BUYS", 0.9),
    relation("industry", "industry-1", "customer", "customer-1", "INDUSTRY_HAS_CUSTOMER", 0.8),
    relation("industry", "industry-2", "industry", "industry-1", "INDUSTRY_HAS_CUSTOMER", 0.7),
    relation("industry", "industry-3", "industry", "industry-2", "INDUSTRY_HAS_CUSTOMER", 0.7),
    relation("industry", "industry-4", "industry", "industry-3", "INDUSTRY_HAS_CUSTOMER", 0.7),
  ];

  return {
    kgEntityProduct: {
      findMany: vi.fn(async () => products),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        products.find((entity) => entity.id === where.id) ?? null,
      ),
    },
    kgEntityCustomer: {
      findMany: vi.fn(async () => customers),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        customers.find((entity) => entity.id === where.id) ?? null,
      ),
    },
    kgEntityIndustry: {
      findMany: vi.fn(async () => industries),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        industries.find((entity) => entity.id === where.id) ?? null,
      ),
    },
    kgEntityProposal: {
      findMany: vi.fn(async () => proposals),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        proposals.find((entity) => entity.id === where.id) ?? null,
      ),
    },
    kgRelation: {
      findMany: vi.fn(async ({ where }: { where?: { relationType?: string } }) =>
        where?.relationType
          ? relations.filter((item) => item.relationType === where.relationType)
          : relations,
      ),
    },
  };
}

function relation(
  fromEntityType: string,
  fromId: string,
  toEntityType: string,
  toId: string,
  relationType: string,
  weight: number,
) {
  return {
    id: `${fromId}-${toId}-${relationType}`,
    fromEntityType,
    fromId,
    toEntityType,
    toId,
    relationType,
    weight,
    source: { kbDocId: "kbdoc-1" },
    createdAt: new Date("2026-06-30T00:00:00.000Z"),
  };
}
