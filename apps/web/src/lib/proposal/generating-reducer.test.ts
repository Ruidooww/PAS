import { describe, expect, it } from "vitest";

import {
  generatingReducer,
  initialGeneratingState,
} from "./generating-reducer";

describe("generatingReducer", () => {
  it("starts with pre-populated chapter slots when chapterIds are known", () => {
    const next = generatingReducer(initialGeneratingState, {
      type: "start",
      total: 3,
      chapterIds: ["background", "solution", "roadmap"],
    });
    expect(next.status).toBe("streaming");
    expect(next.total).toBe(3);
    expect(next.chapters).toHaveLength(3);
    expect(next.chapters.map((chapter) => chapter.status)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks chapters completed as progress events arrive in order", () => {
    let state = generatingReducer(initialGeneratingState, {
      type: "start",
      total: 2,
      chapterIds: ["background", "solution"],
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "background", n: 1, total: 2 },
    });
    expect(state.chapters[0]?.status).toBe("completed");
    expect(state.chapters[1]?.status).toBe("pending");
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "solution", n: 2, total: 2 },
    });
    expect(state.chapters.map((chapter) => chapter.status)).toEqual([
      "completed",
      "completed",
    ]);
  });

  it("records a failure but continues to allow later chapters to complete", () => {
    let state = generatingReducer(initialGeneratingState, {
      type: "start",
      total: 2,
      chapterIds: ["background", "solution"],
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "background", n: 1, total: 2, errorMessage: "LLM down" },
    });
    expect(state.chapters[0]).toMatchObject({
      status: "failed",
      errorMessage: "LLM down",
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "solution", n: 2, total: 2 },
    });
    expect(state.chapters[1]?.status).toBe("completed");
  });

  it("expands chapters when progress arrives without prior start chapterIds", () => {
    let state = generatingReducer(initialGeneratingState, {
      type: "start",
      total: 0,
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "background", n: 1, total: 2 },
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "solution", n: 2, total: 2 },
    });
    expect(state.total).toBe(2);
    expect(state.chapters.map((chapter) => chapter.id)).toEqual([
      "background",
      "solution",
    ]);
  });

  it("transitions to done on a successful terminating event", () => {
    let state = generatingReducer(initialGeneratingState, {
      type: "start",
      total: 1,
      chapterIds: ["only"],
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { chapter: "only", n: 1, total: 1 },
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { done: true },
    });
    expect(state.status).toBe("done");
  });

  it("preserves an error when done arrives with errorMessage", () => {
    let state = generatingReducer(initialGeneratingState, {
      type: "start",
      total: 1,
      chapterIds: ["only"],
    });
    state = generatingReducer(state, {
      type: "progress",
      event: { done: true, errorMessage: "Proposal is no longer eligible" },
    });
    expect(state.status).toBe("error");
    expect(state.error).toBe("Proposal is no longer eligible");
  });
});
