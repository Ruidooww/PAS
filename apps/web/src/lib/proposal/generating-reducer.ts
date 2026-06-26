import type { ProposalProgressEvent } from "./types";

export interface ChapterProgress {
  id: string;
  index: number;
  status: "completed" | "failed" | "pending" | "running";
  errorMessage?: string;
}

export interface GeneratingState {
  total: number;
  chapters: ChapterProgress[];
  status: "done" | "error" | "idle" | "streaming";
  error: string | null;
}

export type GeneratingAction =
  | { type: "start"; total: number; chapterIds?: string[] }
  | { type: "progress"; event: ProposalProgressEvent }
  | { type: "error"; message: string }
  | { type: "reset" };

export const initialGeneratingState: GeneratingState = {
  total: 0,
  chapters: [],
  status: "idle",
  error: null,
};

export function generatingReducer(
  state: GeneratingState,
  action: GeneratingAction,
): GeneratingState {
  switch (action.type) {
    case "start":
      return {
        total: action.total,
        chapters:
          action.chapterIds?.map((id, index) => ({
            id,
            index,
            status: "pending",
          })) ?? [],
        status: "streaming",
        error: null,
      };
    case "progress": {
      const { event } = action;
      if (event.done) {
        return {
          ...state,
          status: event.errorMessage ? "error" : "done",
          error: event.errorMessage ?? state.error,
        };
      }
      if (event.chapter === undefined || event.n === undefined) return state;
      const chapters = applyChapter(state.chapters, event);
      const total = event.total ?? state.total;
      return { ...state, total, chapters };
    }
    case "error":
      return { ...state, status: "error", error: action.message };
    case "reset":
      return initialGeneratingState;
  }
}

function applyChapter(
  chapters: ChapterProgress[],
  event: ProposalProgressEvent,
): ChapterProgress[] {
  if (event.chapter === undefined || event.n === undefined) return chapters;
  const chapterId: string = event.chapter;
  const index = event.n - 1;
  const next: ChapterProgress[] = chapters.length === 0 ? [] : [...chapters];
  while (next.length <= index) {
    next.push({ id: `chapter-${next.length + 1}`, index: next.length, status: "pending" });
  }
  next[index] = {
    id: chapterId,
    index,
    status: event.errorMessage ? "failed" : "completed",
    ...(event.errorMessage === undefined ? {} : { errorMessage: event.errorMessage }),
  };
  for (let i = 0; i < index; i += 1) {
    const item = next[i];
    if (item && item.status === "pending") {
      next[i] = { ...item, status: "completed" };
    }
  }
  return next;
}
