import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { z } from "zod";

export interface GateQueryFixture {
  id: string;
  query: string;
  expectedDocNames: string[];
  expectedPagesLoose: Array<number | string>;
  minTopKHit: number;
}

export interface GateParamFixture {
  name: string;
  rerankId: string | null;
  pageSize: number;
  topK: number;
  similarityThreshold: number;
  vectorSimilarityWeight: number;
  evalTopK: number;
}

export interface GateFixtures {
  queries: GateQueryFixture[];
  params: GateParamFixture[];
}

const nonEmptyString = z.string().trim().min(1);

const queryFixtureSchema = z
  .array(
    z.object({
      id: nonEmptyString,
      query: nonEmptyString,
      expected_doc_names: z.array(nonEmptyString).min(1),
      expected_pages_loose: z.array(z.union([z.number().int().positive(), nonEmptyString])),
      min_top_k_hit: z.number().int().min(0),
    }),
  )
  .min(1)
  .transform((queries) =>
    queries.map<GateQueryFixture>((query) => ({
      id: query.id,
      query: query.query,
      expectedDocNames: query.expected_doc_names,
      expectedPagesLoose: query.expected_pages_loose,
      minTopKHit: query.min_top_k_hit,
    })),
  );

const paramFixtureSchema = z
  .array(
    z.object({
      name: nonEmptyString,
      rerank_model: z.union([nonEmptyString, z.null()]),
      page_size: z.number().int().positive(),
      top_k: z.number().int().positive(),
      similarity_threshold: z.number().min(0).max(1),
      vector_similarity_weight: z.number().min(0).max(1),
      eval_top_k: z.number().int().positive().default(5),
    }),
  )
  .min(1)
  .transform((params) =>
    params.map<GateParamFixture>((param) => ({
      name: param.name,
      rerankId: param.rerank_model,
      pageSize: param.page_size,
      topK: param.top_k,
      similarityThreshold: param.similarity_threshold,
      vectorSimilarityWeight: param.vector_similarity_weight,
      evalTopK: param.eval_top_k,
    })),
  );

export const DEFAULT_FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export async function loadFixtures(fixtureDir = DEFAULT_FIXTURE_DIR): Promise<GateFixtures> {
  const [queries, params] = await Promise.all([
    readYamlFile(join(fixtureDir, "queries.yml"), queryFixtureSchema),
    readYamlFile(join(fixtureDir, "params.yml"), paramFixtureSchema),
  ]);
  return { queries, params };
}

async function readYamlFile<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const raw = await readFile(path, "utf8");
  const parsed = parse(raw);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`${path} validation failed: ${issues}`);
  }
  return result.data;
}
