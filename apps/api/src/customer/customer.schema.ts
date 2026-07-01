import { z } from "zod";

const optionalTrim = z
  .string()
  .transform((value) => value.trim())
  .optional()
  .transform((value) => value || undefined);

const safePage = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .refine(Number.isSafeInteger, { message: "page must be a safe integer" })
  .default("1");

const nonEmptyString = z.string().trim().min(1);

export const opportunityStageSchema = z.enum([
  "discovery",
  "qualified",
  "evaluation",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

export const customerListQuerySchema = z
  .object({
    q: optionalTrim,
    ownerId: optionalTrim,
    page: safePage,
  })
  .strict();

export const opportunityListQuerySchema = z
  .object({
    customerRef: optionalTrim,
    stage: optionalTrim,
    page: safePage,
  })
  .strict();

export const createOpportunitySchema = z
  .object({
    customerRef: nonEmptyString,
    title: nonEmptyString,
    stage: opportunityStageSchema,
    amountEstimate: z.number().positive().nullable(),
  })
  .strict();

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type OpportunityListQuery = z.infer<typeof opportunityListQuerySchema>;
export type CreateOpportunityDto = z.infer<typeof createOpportunitySchema>;
