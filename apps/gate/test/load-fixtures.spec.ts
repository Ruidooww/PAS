import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadFixtures } from "../src/load-fixtures";

async function writeFixtureDir(files: Record<string, string>): Promise<string> {
  const dir = join(tmpdir(), `pas-gate-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, content]) => writeFile(join(dir, name), content, "utf8")),
  );
  return dir;
}

describe("loadFixtures", () => {
  it("loads query and parameter YAML into typed fixtures", async () => {
    const dir = await writeFixtureDir({
      "queries.yml": `
- id: q1
  query: How should policy be configured?
  expected_doc_names:
    - Admin Guide
  expected_pages_loose:
    - 3
  min_top_k_hit: 1
`,
      "params.yml": `
- name: baseline
  rerank_model: gte-rerank-v2@bailian@Tongyi-Qianwen
  page_size: 30
  top_k: 1024
  similarity_threshold: 0.1
  vector_similarity_weight: 0.3
  eval_top_k: 5
`,
    });

    await expect(loadFixtures(dir)).resolves.toEqual({
      queries: [
        {
          id: "q1",
          query: "How should policy be configured?",
          expectedDocNames: ["Admin Guide"],
          expectedPagesLoose: [3],
          minTopKHit: 1,
        },
      ],
      params: [
        {
          name: "baseline",
          rerankId: "gte-rerank-v2@bailian@Tongyi-Qianwen",
          pageSize: 30,
          topK: 1024,
          similarityThreshold: 0.1,
          vectorSimilarityWeight: 0.3,
          evalTopK: 5,
        },
      ],
    });
  });

  it("reports the fixture file and field when YAML validation fails", async () => {
    const dir = await writeFixtureDir({
      "queries.yml": `
- id: q1
  expected_doc_names:
    - Admin Guide
  expected_pages_loose:
    - 3
  min_top_k_hit: 1
`,
      "params.yml": `
- name: baseline
  rerank_model: gte-rerank-v2@bailian@Tongyi-Qianwen
  page_size: 30
  top_k: 1024
  similarity_threshold: 0.1
  vector_similarity_weight: 0.3
  eval_top_k: 5
`,
    });

    await expect(loadFixtures(dir)).rejects.toThrow(/queries.yml.*query/i);
  });
});
