export interface KbDocumentSummary {
  ragflowDocId: string;
  name: string;
  product: string | null;
  aclScope: string;
  sensitivity: string;
  chunkCount: number | null;
  size: number | null;
  ragflowUpdatedAt: string | null;
  syncedAt: string;
}

export interface KbDocumentsStats {
  totalChunks: number | null;
  totalDocs: number;
  byType: Record<string, number>;
}

export interface KbDocumentsResponse {
  items: KbDocumentSummary[];
  stats: KbDocumentsStats;
}
