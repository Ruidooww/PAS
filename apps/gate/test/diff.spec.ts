import { describe, expect, it } from "vitest";

import { compareRuns, renderDiffMarkdown, type GateRunResult } from "../src/diff";

const before: GateRunResult = {
  runId: "2026-06-28T00-00-00-000Z",
  generatedAt: "2026-06-28T00:00:00.000Z",
  results: [
    {
      paramName: "baseline",
      queryId: "q1",
      query: "Question",
      recallAt5: 0.5,
      hitDocs: ["A"],
      missedExpected: ["B"],
      runtimeMs: 100,
    },
  ],
};

const after: GateRunResult = {
  runId: "2026-06-29T00-00-00-000Z",
  generatedAt: "2026-06-29T00:00:00.000Z",
  results: [
    {
      paramName: "baseline",
      queryId: "q1",
      query: "Question",
      recallAt5: 1,
      hitDocs: ["A", "B"],
      missedExpected: [],
      runtimeMs: 130,
    },
  ],
};

describe("compareRuns", () => {
  it("computes recall, hit document, and runtime deltas per param/query", () => {
    expect(compareRuns(before, after)).toEqual([
      {
        key: "baseline::q1",
        paramName: "baseline",
        queryId: "q1",
        query: "Question",
        beforeRecallAt5: 0.5,
        afterRecallAt5: 1,
        recallAt5Delta: 0.5,
        addedHitDocs: ["B"],
        removedHitDocs: [],
        beforeRuntimeMs: 100,
        afterRuntimeMs: 130,
        runtimeMsDelta: 30,
      },
    ]);
  });

  it("renders markdown that highlights numeric deltas", () => {
    expect(renderDiffMarkdown(compareRuns(before, after))).toContain("| baseline | q1 | +0.5000 |");
  });
});
