import { describe, expect, it, vi } from "vitest";

import { KbSyncService } from "../src/internal/kb-sync/kb-sync.service";

type StoredDocument = {
  id: string;
  ragflowDocId: string;
  ragflowKbId: string;
  name: string;
  product: string | null;
  aclScope: string;
  uploadedBy: string | null;
  size: number | null;
  chunkCount: number | null;
  ragflowUpdatedAt: Date | null;
  deletedAt: Date | null;
  syncedAt: Date;
  createdAt: Date;
};

function createConfig(values: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

function createDocument(overrides: Partial<StoredDocument>): StoredDocument {
  return {
    id: overrides.id ?? `doc-${overrides.ragflowDocId ?? "1"}`,
    ragflowDocId: overrides.ragflowDocId ?? "ragflow-doc-1",
    ragflowKbId: overrides.ragflowKbId ?? "pas-kb",
    name: overrides.name ?? "Existing Document",
    product: overrides.product ?? null,
    aclScope: overrides.aclScope ?? "internal",
    uploadedBy: overrides.uploadedBy ?? null,
    size: overrides.size ?? null,
    chunkCount: overrides.chunkCount ?? null,
    ragflowUpdatedAt: overrides.ragflowUpdatedAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    syncedAt: overrides.syncedAt ?? new Date("2026-06-01T00:00:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2026-06-01T00:00:00.000Z"),
  };
}

function createPrisma(seed: StoredDocument[] = []) {
  const documents = [...seed];
  const logs: Array<Record<string, unknown>> = [];
  let documentId = documents.length + 1;
  let logId = 1;

  const prisma = {
    documents,
    logs,
    kbDocument: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { ragflowKbId?: string; ragflowDocId?: { in: string[] } };
        }) => {
          if (where.ragflowDocId?.in) {
            return documents.filter((document) =>
              where.ragflowDocId?.in.includes(document.ragflowDocId),
            );
          }
          return documents.filter((document) => document.ragflowKbId === where.ragflowKbId);
        },
      ),
      create: vi.fn(async ({ data }: { data: Partial<StoredDocument> }) => {
        const document = createDocument({
          id: data.id ?? `kbdoc-${documentId++}`,
          ragflowDocId: data.ragflowDocId,
          ragflowKbId: data.ragflowKbId,
          name: data.name,
          product: data.product ?? null,
          aclScope: data.aclScope ?? "internal",
          uploadedBy: data.uploadedBy ?? null,
          size: data.size ?? null,
          chunkCount: data.chunkCount ?? null,
          ragflowUpdatedAt: data.ragflowUpdatedAt ?? null,
          deletedAt: data.deletedAt ?? null,
          syncedAt: data.syncedAt,
          createdAt: data.createdAt,
        });
        documents.push(document);
        return document;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<StoredDocument> }) => {
          const document = documents.find((candidate) => candidate.id === where.id);
          if (!document) {
            throw new Error(`Document ${where.id} was not found`);
          }
          Object.assign(document, data);
          return document;
        },
      ),
    },
    kbSyncLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const log = {
          id: `log-${logId++}`,
          errorMessage: null,
          runAt: new Date("2026-06-10T00:00:00.000Z"),
          ...data,
        };
        logs.push(log);
        return log;
      }),
    },
  };

  return prisma;
}

describe("KbSyncService", () => {
  it("inserts new RAGFlow documents as internal system documents", async () => {
    const prisma = createPrisma();
    const ragflowClient = {
      listDocs: vi.fn().mockResolvedValue([
        {
          id: "ragflow-doc-1",
          name: "E0 Handbook",
          status: "ready",
          size: 42,
          chunkCount: 17,
          updatedAt: "2026-06-02T03:04:05.000Z",
        },
      ]),
    };
    const service = new KbSyncService(
      createConfig({ PAS_KB_ID: "pas-kb", QA_KB_ID: "pas-kb" }) as never,
      ragflowClient as never,
      prisma as never,
    );

    await expect(service.runOnce()).resolves.toEqual({
      runs: [{ kbId: "pas-kb", added: 1, deleted: 0, updated: 0, status: "success" }],
    });

    expect(prisma.documents).toHaveLength(1);
    expect(prisma.documents[0]).toMatchObject({
      ragflowDocId: "ragflow-doc-1",
      ragflowKbId: "pas-kb",
      name: "E0 Handbook",
      aclScope: "internal",
      uploadedBy: null,
      size: 42,
      chunkCount: 17,
      ragflowUpdatedAt: new Date("2026-06-02T03:04:05.000Z"),
      deletedAt: null,
    });
    expect(prisma.logs).toMatchObject([
      {
        ragflowKbId: "pas-kb",
        addedCount: 1,
        deletedCount: 0,
        updatedCount: 0,
        status: "success",
        errorMessage: null,
      },
    ]);
  });

  it("soft deletes PAS documents missing from RAGFlow", async () => {
    const prisma = createPrisma([createDocument({ id: "kbdoc-1", ragflowDocId: "missing-doc" })]);
    const ragflowClient = { listDocs: vi.fn().mockResolvedValue([]) };
    const service = new KbSyncService(
      createConfig({ PAS_KB_ID: "pas-kb" }) as never,
      ragflowClient as never,
      prisma as never,
    );

    await expect(service.runOnce()).resolves.toEqual({
      runs: [{ kbId: "pas-kb", added: 0, deleted: 1, updated: 0, status: "success" }],
    });

    const document = prisma.documents[0];
    if (!document) throw new Error("Expected seeded document to remain present");
    expect(document.deletedAt).toBeInstanceOf(Date);
    expect(prisma.logs).toMatchObject([{ deletedCount: 1, status: "success" }]);
  });

  it("updates changed document metadata and refreshed sync timestamp", async () => {
    const oldSyncedAt = new Date("2026-06-01T00:00:00.000Z");
    const prisma = createPrisma([
      createDocument({
        id: "kbdoc-1",
        ragflowDocId: "ragflow-doc-1",
        name: "Old Name",
        size: 1,
        chunkCount: 2,
        ragflowUpdatedAt: new Date("2026-06-01T01:00:00.000Z"),
        syncedAt: oldSyncedAt,
      }),
    ]);
    const ragflowClient = {
      listDocs: vi.fn().mockResolvedValue([
        {
          id: "ragflow-doc-1",
          name: "New Name",
          status: "ready",
          size: 2,
          chunkCount: 9,
          updatedAt: "2026-06-02T01:00:00.000Z",
        },
      ]),
    };
    const service = new KbSyncService(
      createConfig({ PAS_KB_ID: "pas-kb" }) as never,
      ragflowClient as never,
      prisma as never,
    );

    await expect(service.runOnce()).resolves.toEqual({
      runs: [{ kbId: "pas-kb", added: 0, deleted: 0, updated: 1, status: "success" }],
    });

    const document = prisma.documents[0];
    if (!document) throw new Error("Expected updated document to remain present");
    expect(document).toMatchObject({
      name: "New Name",
      size: 2,
      chunkCount: 9,
      ragflowUpdatedAt: new Date("2026-06-02T01:00:00.000Z"),
      deletedAt: null,
    });
    expect(document.syncedAt.getTime()).toBeGreaterThan(oldSyncedAt.getTime());
    expect(prisma.logs).toMatchObject([{ updatedCount: 1, status: "success" }]);
  });

  it("updates an existing RAGFlow document row from another KB instead of duplicating it", async () => {
    const prisma = createPrisma([
      createDocument({
        id: "kbdoc-1",
        ragflowDocId: "mock-document",
        ragflowKbId: "seed-kb",
        name: "Seeded Document",
        uploadedBy: "mock-user-1",
      }),
    ]);
    const ragflowClient = {
      listDocs: vi.fn().mockResolvedValue([
        { id: "mock-document", name: "Manual KB Document", status: "ready" },
      ]),
    };
    const service = new KbSyncService(
      createConfig({ PAS_KB_ID: "manual-kb" }) as never,
      ragflowClient as never,
      prisma as never,
    );

    await expect(service.runOnce()).resolves.toEqual({
      runs: [{ kbId: "manual-kb", added: 0, deleted: 0, updated: 1, status: "success" }],
    });

    expect(prisma.documents).toHaveLength(1);
    expect(prisma.documents[0]).toMatchObject({
      ragflowDocId: "mock-document",
      ragflowKbId: "manual-kb",
      name: "Manual KB Document",
      uploadedBy: "mock-user-1",
    });
    expect(prisma.logs).toMatchObject([{ updatedCount: 1, status: "success" }]);
  });

  it("records a failed run and a later mixed retry reconciles the table", async () => {
    const prisma = createPrisma([
      createDocument({ id: "kbdoc-delete", ragflowDocId: "stale-doc", name: "Stale" }),
      createDocument({
        id: "kbdoc-update",
        ragflowDocId: "ragflow-doc-1",
        name: "Old Name",
        size: 8,
        ragflowUpdatedAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ]);
    const ragflowClient = {
      listDocs: vi
        .fn()
        .mockRejectedValueOnce(new Error("ragflow unavailable"))
        .mockResolvedValueOnce([
          {
            id: "ragflow-doc-1",
            name: "Updated Name",
            status: "ready",
            size: 16,
            updatedAt: "2026-06-03T00:00:00.000Z",
          },
          {
            id: "ragflow-doc-2",
            name: "New Doc",
            status: "ready",
            size: 32,
            updatedAt: "2026-06-03T01:00:00.000Z",
          },
        ]),
    };
    const service = new KbSyncService(
      createConfig({ PAS_KB_ID: "pas-kb" }) as never,
      ragflowClient as never,
      prisma as never,
    );

    await expect(service.runOnce()).resolves.toEqual({
      runs: [
        {
          kbId: "pas-kb",
          added: 0,
          deleted: 0,
          updated: 0,
          status: "failed",
          errorMessage: "ragflow unavailable",
        },
      ],
    });
    expect(prisma.logs).toMatchObject([{ status: "failed", errorMessage: "ragflow unavailable" }]);

    await expect(service.runOnce()).resolves.toEqual({
      runs: [{ kbId: "pas-kb", added: 1, deleted: 1, updated: 1, status: "success" }],
    });

    expect(prisma.documents).toHaveLength(3);
    expect(prisma.documents.find((document) => document.ragflowDocId === "stale-doc")?.deletedAt)
      .toBeInstanceOf(Date);
    expect(prisma.documents.find((document) => document.ragflowDocId === "ragflow-doc-1"))
      .toMatchObject({ name: "Updated Name", size: 16, deletedAt: null });
    expect(prisma.documents.find((document) => document.ragflowDocId === "ragflow-doc-2"))
      .toMatchObject({ name: "New Doc", uploadedBy: null, aclScope: "internal" });
    expect(prisma.logs).toMatchObject([
      { status: "failed", errorMessage: "ragflow unavailable" },
      { addedCount: 1, deletedCount: 1, updatedCount: 1, status: "success" },
    ]);
  });
});
