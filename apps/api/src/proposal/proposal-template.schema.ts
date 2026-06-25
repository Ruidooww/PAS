import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const proposalTemplateSectionSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    retrievalIntent: nonEmptyString,
    promptTemplate: nonEmptyString,
    variables: z.array(nonEmptyString),
    fixed: z.literal(true).optional(),
  })
  .strict();

export const proposalTemplateSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    version: z.number().int().positive(),
    product: nonEmptyString,
    sections: z.array(proposalTemplateSectionSchema).min(1),
  })
  .strict()
  .superRefine((template, context) => {
    const sectionIds = new Set<string>();
    for (const [index, section] of template.sections.entries()) {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate section id: ${section.id}`,
          path: ["sections", index, "id"],
        });
      }
      sectionIds.add(section.id);
    }
  });

export type ProposalTemplate = z.infer<typeof proposalTemplateSchema>;
