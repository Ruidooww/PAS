import { loadPrompt } from "../prompts/loader";

export const QA_PROMPT = Symbol("QA_PROMPT");

export function readQaPrompt(): string {
  return loadPrompt("qa_answer");
}
