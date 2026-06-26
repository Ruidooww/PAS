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

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type OpportunityListQuery = z.infer<typeof opportunityListQuerySchema>;
