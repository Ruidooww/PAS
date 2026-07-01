import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../../auth/auth.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { InternalOnlyGuard } from "../internal-only.guard";

export interface KbDocumentDto {
  ragflowDocId: string;
  name: string;
  product: string | null;
  aclScope: string;
  sensitivity: string;
  size: number | null;
  ragflowUpdatedAt: string | null;
  syncedAt: string;
}

export interface KbDocumentsResponse {
  items: KbDocumentDto[];
  stats: {
    totalChunks: number | null;
    totalDocs: number;
    byType: Record<string, number>;
  };
}

type KbDocumentRow = {
  ragflowDocId: string;
  name: string;
  product: string | null;
  aclScope: string;
  sensitivity: string;
  size: number | null;
  ragflowUpdatedAt: Date | null;
  syncedAt: Date;
};

@Controller("api/internal/kb-documents")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class KbDocumentsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(): Promise<KbDocumentsResponse> {
    const documents = (await this.prisma.kbDocument.findMany({
      where: { deletedAt: null },
      orderBy: [{ syncedAt: "desc" }, { name: "asc" }],
      select: {
        ragflowDocId: true,
        name: true,
        product: true,
        aclScope: true,
        sensitivity: true,
        size: true,
        ragflowUpdatedAt: true,
        syncedAt: true,
      },
    })) as KbDocumentRow[];
    const items = documents.map(toDto);
    return {
      items,
      stats: {
        totalChunks: null,
        totalDocs: items.length,
        byType: countByProduct(items),
      },
    };
  }
}

function toDto(document: KbDocumentRow): KbDocumentDto {
  return {
    ragflowDocId: document.ragflowDocId,
    name: document.name,
    product: document.product,
    aclScope: document.aclScope,
    sensitivity: document.sensitivity,
    size: document.size,
    ragflowUpdatedAt: document.ragflowUpdatedAt?.toISOString() ?? null,
    syncedAt: document.syncedAt.toISOString(),
  };
}

function countByProduct(items: KbDocumentDto[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.product ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
