import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

import { loadFixtures } from "./load-fixtures";
import { RagflowGateClient } from "./ragflow-client";
import { persistRun, renderReport, type GateSuiteResult } from "./report";

const modulePath = fileURLToPath(import.meta.url);

loadDotenv({ path: join(dirname(modulePath), "..", ".env"), quiet: true });

interface CliOptions {
  params: string;
}

export async function runSuite(options: CliOptions): Promise<void> {
  const baseUrl = requiredEnv("RAGFLOW_BASE_URL");
  const apiKey = requiredEnv("RAGFLOW_API_KEY");
  const kbId = requiredEnv("PAS_GATE_KB_ID");
  const fixtures = await loadFixtures();
  const selectedParams =
    options.params === "all"
      ? fixtures.params
      : fixtures.params.filter((param) => param.name === options.params);
  if (selectedParams.length === 0) {
    throw new Error(`Unknown params group: ${options.params}`);
  }

  const client = new RagflowGateClient({ baseUrl, apiKey });
  const results: GateSuiteResult[] = [];

  for (const param of selectedParams) {
    for (const query of fixtures.queries) {
      const start = performance.now();
      const chunks = await client.retrieve({
        query: query.query,
        kbId,
        pageSize: param.pageSize,
        topK: param.topK,
        similarityThreshold: param.similarityThreshold,
        vectorSimilarityWeight: param.vectorSimilarityWeight,
        rerankId: param.rerankId,
      });
      const runtimeMs = Math.round(performance.now() - start);
      const topChunks = chunks.slice(0, param.evalTopK);
      const returnedDocNames = topChunks.map((chunk) => chunk.documentName);
      const expectedDocNames = query.expectedDocNames.filter((name) => name !== "<replace_me>");
      const hitDocs = expectedDocNames.filter((expected) => returnedDocNames.includes(expected));
      const missedExpected = expectedDocNames.filter((expected) => !hitDocs.includes(expected));
      results.push({
        paramName: param.name,
        queryId: query.id,
        query: query.query,
        recallAt5: expectedDocNames.length === 0 ? 0 : hitDocs.length / expectedDocNames.length,
        hitDocs,
        missedExpected,
        runtimeMs,
      });
    }
  }

  const { run, outputDir } = await persistRun(results);
  process.stdout.write(renderReport(run));
  process.stdout.write(`\nSaved gate results to ${outputDir}\n`);
}

function parseCli(argv: string[]): CliOptions {
  const paramsIndex = argv.indexOf("--params");
  return { params: paramsIndex >= 0 ? argv[paramsIndex + 1] ?? "all" : "all" };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

if (process.argv[1] === modulePath) {
  runSuite(parseCli(process.argv.slice(2))).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
