import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type { RagflowDocument } from "@pas/shared";

import { RAGFLOW_CLIENT, type RagflowClient } from "../../clients/ragflow";
import { PrismaService } from "../../prisma/prisma.service";
import { KgExtractQueue } from "../kg-sync/kg-extract.queue";

export type KbSyncStatus = "success" | "failed";

export interface KbSyncRunResult {
  kbId: string;
  added: number;
  deleted: number;
  updated: number;
  status: KbSyncStatus;
  errorMessage?: string;
}

export interface KbSyncRunSummary {
  runs: KbSyncRunResult[];
}

export interface KbSyncRunOptions {
  recordFailures?: boolean;
  throwOnFailure?: boolean;
}

export interface KbSyncLogListParams {
  kbId?: string;
  page?: number;
  pageSize?: number;
}

export interface KbSyncLogListResponse {
  page: number;
  pageSize: number;
  items: Array<{
    id: string;
    ragflowKbId: string;
    addedCount: number;
    deletedCount: number;
    updatedCount: number;
    status: string;
    errorMessage: string | null;
    runAt: Date;
  }>;
}

interface NormalizedRagflowDocument {
  id: string;
  name: string;
  size: number | null;
  ragflowUpdatedAt: Date | null;
}

@Injectable()
export class KbSyncService {
  private readonly logger = new Logger(KbSyncService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(KgExtractQueue)
    private readonly kgExtractQueue?: Pick<KgExtractQueue, "enqueue">,
  ) {}

  async runOnce(options: KbSyncRunOptions = {}): Promise<KbSyncRunSummary> {
    const runs: KbSyncRunResult[] = [];
    const recordFailures = options.recordFailures ?? true;

    for (const kbId of this.kbIds()) {
      try {
        runs.push(await this.syncKb(kbId));
      } catch (err) {
        const errorMessage = formatError(err);
        const failedRun: KbSyncRunResult = {
          kbId,
          added: 0,
          deleted: 0,
          updated: 0,
          status: "failed",
          errorMessage,
        };
        if (recordFailures) {
          await this.writeLog(failedRun);
        }
        if (options.throwOnFailure) {
          throw err;
        }
        runs.push(failedRun);
      }
    }

    return { runs };
  }

  async listLogs(params: KbSyncLogListParams): Promise<KbSyncLogListResponse> {
    const page = normalizePositiveInt(params.page, 1);
    const pageSize = Math.min(normalizePositiveInt(params.pageSize, 20), 100);
    const where: Prisma.KbSyncLogWhereInput = params.kbId ? { ragflowKbId: params.kbId } : {};
    const items = await this.prisma.kbSyncLog.findMany({
      where,
      orderBy: { runAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      page,
      pageSize,
      items: items.map((item) => ({
        id: item.id,
        ragflowKbId: item.ragflowKbId,
        addedCount: item.addedCount,
        deletedCount: item.deletedCount,
        updatedCount: item.updatedCount,
        status: item.status,
        errorMessage: item.errorMessage,
        runAt: item.runAt,
      })),
    };
  }

  private async syncKb(kbId: string): Promise<KbSyncRunResult> {
    const now = new Date();
    // TODO(v2): page through RAGFlow documents when listDocs exposes pagination.
    const remoteDocuments = (await this.ragflowClient.listDocs(kbId)).map(normalizeDocument);
    const remoteDocumentIdList = remoteDocuments.map((document) => document.id);
    const remoteDocumentIds = new Set(remoteDocumentIdList);
    const existingDocuments = await this.prisma.kbDocument.findMany({
      where: { ragflowKbId: kbId },
    });
    const globallyExistingDocuments =
      remoteDocumentIdList.length > 0
        ? await this.prisma.kbDocument.findMany({
            where: { ragflowDocId: { in: remoteDocumentIdList } },
          })
        : [];
    const existingByRagflowId = new Map([
      ...globallyExistingDocuments.map((document) => [document.ragflowDocId, document] as const),
      ...existingDocuments.map((document) => [document.ragflowDocId, document] as const),
    ]);

    let added = 0;
    let deleted = 0;
    let updated = 0;

    for (const remoteDocument of remoteDocuments) {
      const existingDocument = existingByRagflowId.get(remoteDocument.id);
      if (!existingDocument) {
        const created = await this.prisma.kbDocument.create({
          data: {
            ragflowDocId: remoteDocument.id,
            ragflowKbId: kbId,
            name: remoteDocument.name,
            size: remoteDocument.size,
            ragflowUpdatedAt: remoteDocument.ragflowUpdatedAt,
            syncedAt: now,
          } satisfies Prisma.KbDocumentUncheckedCreateInput,
        });
        await this.enqueueKgExtract(created.id);
        added += 1;
        continue;
      }

      const update: Prisma.KbDocumentUncheckedUpdateInput = {};
      if (existingDocument.ragflowKbId !== kbId) {
        update.ragflowKbId = kbId;
      }
      if (existingDocument.name !== remoteDocument.name) {
        update.name = remoteDocument.name;
      }
      if (existingDocument.size !== remoteDocument.size) {
        update.size = remoteDocument.size;
      }
      if (!datesEqual(existingDocument.ragflowUpdatedAt, remoteDocument.ragflowUpdatedAt)) {
        update.ragflowUpdatedAt = remoteDocument.ragflowUpdatedAt;
      }
      if (existingDocument.deletedAt !== null) {
        update.deletedAt = null;
      }
      if (Object.keys(update).length > 0) {
        update.syncedAt = now;
        const updatedDocument = await this.prisma.kbDocument.update({
          where: { id: existingDocument.id },
          data: update,
        });
        await this.enqueueKgExtract(updatedDocument.id);
        updated += 1;
      }
    }

    for (const existingDocument of existingDocuments) {
      if (remoteDocumentIds.has(existingDocument.ragflowDocId) || existingDocument.deletedAt) {
        continue;
      }
      await this.prisma.kbDocument.update({
        where: { id: existingDocument.id },
        data: {
          deletedAt: now,
          syncedAt: now,
        } satisfies Prisma.KbDocumentUncheckedUpdateInput,
      });
      deleted += 1;
    }

    const result: KbSyncRunResult = {
      kbId,
      added,
      deleted,
      updated,
      status: "success",
    };
    await this.writeLog(result);
    return result;
  }

  private async writeLog(result: KbSyncRunResult): Promise<void> {
    await this.prisma.kbSyncLog.create({
      data: {
        ragflowKbId: result.kbId,
        addedCount: result.added,
        deletedCount: result.deleted,
        updatedCount: result.updated,
        status: result.status,
        errorMessage: result.errorMessage ?? null,
        runAt: new Date(),
      },
    });
  }

  private kbIds(): string[] {
    const ids = [this.config.get<string>("PAS_KB_ID"), this.config.get<string>("QA_KB_ID")];
    const unique = new Set<string>();
    for (const id of ids) {
      const normalized = id?.trim();
      if (normalized) unique.add(normalized);
    }
    return [...unique];
  }

  private async enqueueKgExtract(kbDocId: string): Promise<void> {
    if (!this.kgExtractQueue) return;
    try {
      await this.kgExtractQueue.enqueue({ kbDocId });
    } catch (err) {
      this.logger.warn(
        `KG extraction enqueue failed for ${kbDocId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function normalizeDocument(document: RagflowDocument): NormalizedRagflowDocument {
  return {
    id: document.id,
    name: document.name,
    size: document.size ?? null,
    ragflowUpdatedAt: parseOptionalDate(document.updatedAt),
  };
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function datesEqual(left: Date | null, right: Date | null): boolean {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}
