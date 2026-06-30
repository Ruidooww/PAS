import { beforeEach, describe, expect, it, vi } from "vitest";

import { LLM_CLIENT } from "../src/clients/llm";
import { RAGFLOW_CLIENT } from "../src/clients/ragflow";
import {
  KG_EXTRACT_PROMPT,
  KgExtractService,
} from "../src/internal/kg-sync/kg-extract.service";

describe("KgExtractService", () => {
  const llmComplete = vi.fn();
  const ragflowRetrieve = vi.fn();
  let prisma: ReturnType<typeof createPrisma>;
  let service: KgExtractService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrisma();
    service = new KgExtractService(
      { complete: llmComplete } as never,
      { retrieve: ragflowRetrieve } as never,
      prisma as never,
      "Extract PAS KG JSON only.",
    );
  });

  it("extracts KG entities from a KbDocument through llmClient and stores source provenance", async () => {
    prisma.kbDocuments.push({
      id: "kbdoc-1",
      ragflowDocId: "ragflow-doc-1",
      ragflowKbId: "proposal-kb",
      name: "IP-Guard finance proposal",
      product: "IP-Guard",
      deletedAt: null,
    });
    ragflowRetrieve.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "ragflow-doc-1",
        content: "ABC Bank uses IP-Guard DLP in the finance industry.",
        score: 0.92,
        metadata: { page: 3 },
      },
    ]);
    llmComplete.mockResolvedValue(JSON.stringify(extractionPayload()));

    await expect(service.extractDocument("kbdoc-1")).resolves.toEqual({
      kbDocId: "kbdoc-1",
      products: 1,
      proposals: 1,
      customers: 1,
      industries: 1,
      relations: 2,
    });

    expect(ragflowRetrieve).toHaveBeenCalledWith(
      {
        kbId: "proposal-kb",
        query: "IP-Guard finance proposal",
        topK: 20,
        docIdWhitelist: ["ragflow-doc-1"],
      },
      expect.objectContaining({
        uid: "kg-extract-worker",
        role: "system_service",
        isExternal: false,
      }),
    );
    expect(llmComplete).toHaveBeenCalledWith({
      messages: [
        { role: "system", content: "Extract PAS KG JSON only." },
        {
          role: "user",
          content: expect.stringContaining("ABC Bank uses IP-Guard"),
        },
      ],
      temperature: 0,
    });
    expect(prisma.products).toEqual([
      expect.objectContaining({
        id: "product-1",
        name: "IP-Guard",
        category: "DLP",
        vendor: "HYYA",
        aliases: ["IPG"],
      }),
    ]);
    expect(prisma.relations).toEqual([
      expect.objectContaining({
        fromEntityType: "proposal",
        fromId: "proposal-1",
        toEntityType: "product",
        toId: "product-1",
        relationType: "PRODUCT_USES",
        source: {
          kbDocId: "kbdoc-1",
          ragflowDocId: "ragflow-doc-1",
          chunkIds: ["chunk-1"],
        },
      }),
      expect.objectContaining({
        fromEntityType: "customer",
        fromId: "customer-1",
        toEntityType: "product",
        toId: "product-1",
        relationType: "CUSTOMER_BUYS",
      }),
    ]);
  });

  it("deduplicates repeated relations from a single extraction response", async () => {
    prisma.kbDocuments.push({
      id: "kbdoc-1",
      ragflowDocId: "ragflow-doc-1",
      ragflowKbId: "proposal-kb",
      name: "IP-Guard finance proposal",
      product: "IP-Guard",
      deletedAt: null,
    });
    ragflowRetrieve.mockResolvedValue([]);
    const payload = extractionPayload();
    payload.relations.push({ ...payload.relations[0]! });
    llmComplete.mockResolvedValue(JSON.stringify(payload));

    await service.extractDocument("kbdoc-1");

    expect(prisma.relations).toHaveLength(2);
    expect(prisma.relationUpserts).toHaveLength(2);
  });

  it("is provided through the expected DI tokens", () => {
    expect(KG_EXTRACT_PROMPT).toBeDefined();
    expect(LLM_CLIENT).toBeDefined();
    expect(RAGFLOW_CLIENT).toBeDefined();
  });
});

function extractionPayload() {
  return {
    entities: {
      products: [
        {
          key: "product:ip-guard",
          name: "IP-Guard",
          category: "DLP",
          vendor: "HYYA",
          aliases: ["IPG"],
          metadata: { deployment: "private" },
        },
      ],
      proposals: [
        {
          key: "proposal:finance",
          title: "Finance DLP proposal",
          customerKey: "customer:abc-bank",
          templateId: "ip-guard-standard-v1",
          chapters: ["背景", "方案"],
        },
      ],
      customers: [
        {
          key: "customer:abc-bank",
          name: "ABC Bank",
          industry: "Finance",
          scale: "large",
          crmId: "crm-abc",
        },
      ],
      industries: [
        {
          key: "industry:finance",
          name: "Finance",
          code: "FIN",
        },
      ],
    },
    relations: [
      {
        fromType: "proposal",
        fromKey: "proposal:finance",
        toType: "product",
        toKey: "product:ip-guard",
        relationType: "PRODUCT_USES",
        weight: 0.91,
      },
      {
        fromType: "customer",
        fromKey: "customer:abc-bank",
        toType: "product",
        toKey: "product:ip-guard",
        relationType: "CUSTOMER_BUYS",
        weight: 0.87,
      },
    ],
  };
}

function createPrisma() {
  const state = {
    kbDocuments: [] as Array<{
      id: string;
      ragflowDocId: string;
      ragflowKbId: string;
      name: string;
      product: string | null;
      deletedAt: Date | null;
    }>,
    products: [] as Record<string, unknown>[],
    proposals: [] as Record<string, unknown>[],
    customers: [] as Record<string, unknown>[],
    industries: [] as Record<string, unknown>[],
    relations: [] as Record<string, unknown>[],
    relationUpserts: [] as Record<string, unknown>[],
  };

  return {
    ...state,
    kbDocument: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.kbDocuments.find((document) => document.id === where.id) ?? null,
      ),
      findMany: vi.fn(async () => state.kbDocuments),
    },
    kgEntityProduct: entityDelegate(state.products, "product"),
    kgEntityProposal: entityDelegate(state.proposals, "proposal"),
    kgEntityCustomer: entityDelegate(state.customers, "customer"),
    kgEntityIndustry: entityDelegate(state.industries, "industry"),
    kgRelation: {
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => {
        state.relationUpserts.push(args.create);
        state.relations.push({ id: `relation-${state.relations.length + 1}`, ...args.create });
        return state.relations[state.relations.length - 1];
      }),
    },
  };
}

function entityDelegate(rows: Record<string, unknown>[], prefix: string) {
  return {
    upsert: vi.fn(async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const name = (args.create.name ?? args.create.title) as string;
      const existing = rows.find((row) => (row.name ?? row.title) === name);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row = { id: `${prefix}-${rows.length + 1}`, ...args.create };
      rows.push(row);
      return row;
    }),
  };
}
