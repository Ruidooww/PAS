import type { Prisma } from "@prisma/client";
import { z } from "zod";

const optionalCustomerRef = z
  .string()
  .transform((value) => value.trim())
  .optional()
  .transform((value) => value || undefined);

export const proposalListQuerySchema = z
  .object({
    customerRef: optionalCustomerRef,
    page: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .refine(Number.isSafeInteger, {
        message: "page must be a safe integer",
      })
      .default("1"),
  })
  .strict();

export const proposalPatchSchema = z
  .object({
    section: z
      .object({
        id: z.string().trim().min(1),
        body: z.string(),
      })
      .strict(),
  })
  .strict();

export type ProposalListQuery = z.infer<typeof proposalListQuerySchema>;
export type ProposalPatch = z.infer<typeof proposalPatchSchema>;

type JsonRecord = Record<string, Prisma.JsonValue>;

export function normalizeProposalContent(
  contentJson: Prisma.JsonValue | null,
): Prisma.JsonValue | null {
  const content = proposalContent(contentJson);
  if (!content) return contentJson;
  const sections = sectionsWithIds(content.sections);

  return {
    ...content,
    sections: sections.map(({ section, id }) => ({
      ...section,
      id,
    })),
  };
}

export function patchProposalSection(
  contentJson: Prisma.JsonValue | null,
  requestedId: string,
  body: string,
): Prisma.InputJsonValue | undefined {
  const content = proposalContent(contentJson);
  if (!content) return undefined;
  const sections = sectionsWithIds(content.sections);

  const sectionIndex = sections.findIndex(({ id }) => id === requestedId);
  if (sectionIndex === -1) return undefined;

  return {
    ...content,
    sections: content.sections.map((section, index) =>
      index === sectionIndex ? { ...section, body } : section,
    ),
  } as Prisma.InputJsonValue;
}

function proposalContent(
  contentJson: Prisma.JsonValue | null,
): (JsonRecord & { sections: JsonRecord[] }) | undefined {
  if (!isJsonRecord(contentJson) || !Array.isArray(contentJson.sections)) {
    return undefined;
  }
  if (!contentJson.sections.every(isJsonRecord)) return undefined;
  return contentJson as JsonRecord & { sections: JsonRecord[] };
}

function sectionsWithIds(
  sections: JsonRecord[],
): Array<{ section: JsonRecord; id: string }> {
  const explicitIds: Array<string | null> = sections.map((section) => {
    if (typeof section.id !== "string") return null;
    const trimmed = section.id.trim();
    return trimmed.length > 0 ? trimmed : null;
  });
  const reservedIds = new Set(
    explicitIds.filter((id): id is string => id !== null),
  );
  const usedIds = new Set<string>();

  return sections.map((section, index) => {
    const explicit = explicitIds[index];
    if (typeof explicit === "string" && !usedIds.has(explicit)) {
      usedIds.add(explicit);
      return { section, id: explicit };
    }

    let suffix = index + 1;
    let id = `section-${suffix}`;
    while (usedIds.has(id) || reservedIds.has(id)) {
      suffix += 1;
      id = `section-${suffix}`;
    }
    usedIds.add(id);
    return { section, id };
  });
}

function isJsonRecord(value: Prisma.JsonValue | null): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
