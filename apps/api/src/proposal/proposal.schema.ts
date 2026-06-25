import { z } from "zod";

const normalizedString = z.string().transform((value) => value.trim());
const normalizedStringArray = z.array(z.string().trim().min(1));

export const draftRequirementRequestSchema = z
  .object({
    freeText: normalizedString.optional(),
    formFields: z
      .object({
        customerName: normalizedString,
        industry: normalizedString,
        scale: z
          .union([z.string(), z.number().finite()])
          .transform((value) => String(value).trim()),
        needs: normalizedStringArray,
        constraints: normalizedStringArray,
      })
      .strict(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    freeText: value.freeText || undefined,
  }));

export const requirementSchema = z
  .object({
    customer: z.string().trim().min(1),
    industry: z.string().trim().min(1),
    scale: z.string().trim().min(1),
    needs: normalizedStringArray,
    constraints: normalizedStringArray,
  })
  .strict();

export const llmRequirementSchema = z
  .object({
    requirement_json: requirementSchema,
  })
  .strict();

export type DraftRequirementRequest = z.infer<typeof draftRequirementRequestSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
