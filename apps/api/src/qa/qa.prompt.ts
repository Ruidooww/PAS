import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const QA_PROMPT = Symbol("QA_PROMPT");

export function readQaPrompt(): string {
  const candidates = [
    join(process.cwd(), "prompts", "qa_answer.txt"),
    join(process.cwd(), "apps", "api", "prompts", "qa_answer.txt"),
    join(__dirname, "..", "..", "prompts", "qa_answer.txt"),
  ];
  const promptPath = candidates.find((candidate) => existsSync(candidate));
  if (!promptPath) throw new Error("QA prompt file not found");
  return readFileSync(promptPath, "utf8");
}
