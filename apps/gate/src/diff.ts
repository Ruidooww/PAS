import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_RESULTS_DIR, type GateRunResult, type GateSuiteResult } from "./report";

export type { GateRunResult, GateSuiteResult };

export interface GateDiffRow {
  key: string;
  paramName: string;
  queryId: string;
  query: string;
  beforeRecallAt5: number | null;
  afterRecallAt5: number | null;
  recallAt5Delta: number | null;
  addedHitDocs: string[];
  removedHitDocs: string[];
  beforeRuntimeMs: number | null;
  afterRuntimeMs: number | null;
  runtimeMsDelta: number | null;
}

export function compareRuns(before: GateRunResult, after: GateRunResult): GateDiffRow[] {
  const beforeByKey = indexResults(before.results);
  const afterByKey = indexResults(after.results);
  const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])].sort();

  return keys.map((key) => {
    const beforeResult = beforeByKey.get(key);
    const afterResult = afterByKey.get(key);
    const beforeHitDocs = new Set(beforeResult?.hitDocs ?? []);
    const afterHitDocs = new Set(afterResult?.hitDocs ?? []);
    return {
      key,
      paramName: afterResult?.paramName ?? beforeResult?.paramName ?? "",
      queryId: afterResult?.queryId ?? beforeResult?.queryId ?? "",
      query: afterResult?.query ?? beforeResult?.query ?? "",
      beforeRecallAt5: beforeResult?.recallAt5 ?? null,
      afterRecallAt5: afterResult?.recallAt5 ?? null,
      recallAt5Delta:
        beforeResult && afterResult ? roundMetric(afterResult.recallAt5 - beforeResult.recallAt5) : null,
      addedHitDocs: [...afterHitDocs].filter((doc) => !beforeHitDocs.has(doc)).sort(),
      removedHitDocs: [...beforeHitDocs].filter((doc) => !afterHitDocs.has(doc)).sort(),
      beforeRuntimeMs: beforeResult?.runtimeMs ?? null,
      afterRuntimeMs: afterResult?.runtimeMs ?? null,
      runtimeMsDelta:
        beforeResult && afterResult ? afterResult.runtimeMs - beforeResult.runtimeMs : null,
    };
  });
}

export function renderDiffMarkdown(rows: GateDiffRow[]): string {
  const lines = [
    "# RAGFlow Gate Diff",
    "",
    "| Param | Query | Recall@5 delta | Hit docs added | Hit docs removed | Runtime ms delta |",
    "| --- | --- | ---: | --- | --- | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      [
        row.paramName,
        row.queryId,
        formatDelta(row.recallAt5Delta, 4),
        row.addedHitDocs.join(", ") || "-",
        row.removedHitDocs.join(", ") || "-",
        formatDelta(row.runtimeMsDelta, 0),
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

export async function loadRun(runId: string, resultsDir = DEFAULT_RESULTS_DIR): Promise<GateRunResult> {
  const raw = await readFile(join(resultsDir, runId, "results.json"), "utf8");
  return JSON.parse(raw) as GateRunResult;
}

function indexResults(results: GateSuiteResult[]): Map<string, GateSuiteResult> {
  return new Map(results.map((result) => [`${result.paramName}::${result.queryId}`, result]));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function formatDelta(value: number | null, digits: number): string {
  if (value === null) return "-";
  const formatted = digits > 0 ? value.toFixed(digits) : String(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

async function main(): Promise<void> {
  const [beforeRunId, afterRunId] = process.argv.slice(2);
  if (!beforeRunId || !afterRunId) {
    throw new Error("Usage: pnpm gate:diff <runId1> <runId2>");
  }
  const [before, after] = await Promise.all([loadRun(beforeRunId), loadRun(afterRunId)]);
  process.stdout.write(renderDiffMarkdown(compareRuns(before, after)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
