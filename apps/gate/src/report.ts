import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface GateSuiteResult {
  paramName: string;
  queryId: string;
  query: string;
  recallAt5: number;
  hitDocs: string[];
  missedExpected: string[];
  runtimeMs: number;
}

export interface GateRunResult {
  runId: string;
  generatedAt: string;
  results: GateSuiteResult[];
}

export const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "results");

export async function persistRun(
  results: GateSuiteResult[],
  resultsDir = DEFAULT_RESULTS_DIR,
): Promise<{ run: GateRunResult; outputDir: string }> {
  const generatedAt = new Date().toISOString();
  const runId = generatedAt.replaceAll(":", "-").replace(".", "-");
  const run: GateRunResult = { runId, generatedAt, results };
  const outputDir = join(resultsDir, runId);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "results.json"), `${JSON.stringify(run, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "report.md"), renderReport(run), "utf8"),
  ]);
  return { run, outputDir };
}

export function renderReport(run: GateRunResult): string {
  const lines = [
    `# RAGFlow Gate Report`,
    "",
    `Run: \`${run.runId}\``,
    `Generated: \`${run.generatedAt}\``,
    "",
    "| Param | Query | Recall@5 | Hit Docs | Missed Expected | Runtime ms |",
    "| --- | --- | ---: | --- | --- | ---: |",
  ];
  for (const result of run.results) {
    lines.push(
      [
        result.paramName,
        result.queryId,
        result.recallAt5.toFixed(4),
        result.hitDocs.join(", ") || "-",
        result.missedExpected.join(", ") || "-",
        String(result.runtimeMs),
      ]
        .map(markdownCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");
  return lines.join("\n");
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}
