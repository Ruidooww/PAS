import type { Prisma } from "@prisma/client";

export interface ExportReference {
  n: number;
  docName: string;
  page?: number;
}

export interface ExportSection {
  title: string;
  body: string;
  refs: ExportReference[];
}

export interface ExportContent {
  sections: ExportSection[];
}

export function parseExportContent(
  json: Prisma.JsonValue | null,
): ExportContent | null {
  if (!isRecord(json)) return null;
  const sections = json["sections"];
  if (!Array.isArray(sections)) return null;
  const parsed: ExportSection[] = [];
  for (const raw of sections) {
    if (!isRecord(raw)) return null;
    const title = stringOrEmpty(raw["title"]);
    const body = stringOrEmpty(raw["body"]);
    const refs = parseRefs(raw["refs"]);
    parsed.push({ title, body, refs });
  }
  return { sections: parsed };
}

function parseRefs(value: unknown): ExportReference[] {
  if (!Array.isArray(value)) return [];
  const refs: ExportReference[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const n = numberValue(raw["n"]);
    if (n === undefined) continue;
    const docName = stringOrEmpty(raw["docName"]);
    const page = numberValue(raw["page"]);
    refs.push(page === undefined ? { n, docName } : { n, docName, page });
  }
  return refs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}
