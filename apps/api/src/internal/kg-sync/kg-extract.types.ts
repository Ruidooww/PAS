export interface KgExtractJob {
  kbDocId: string;
}

export interface KgExtractSummary {
  kbDocId: string;
  products: number;
  proposals: number;
  customers: number;
  industries: number;
  relations: number;
}
