import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const promptNames = [
  "kg_extract",
  "qa_answer",
  "proposal_requirement",
  "proposal_section",
] as const;

export type PromptName = (typeof promptNames)[number];
type PromptFileName = `${PromptName}.txt`;

const expectedPromptFiles = promptNames.map((name): PromptFileName => `${name}.txt`);
const promptMap = Object.freeze(loadPrompts());

export function loadPrompt(name: PromptName, vars?: Record<string, string>): string {
  const template = promptMap.get(name);
  if (template === undefined) {
    throw new Error(`Prompt not loaded: ${name}`);
  }
  if (!vars) {
    assertNoPlaceholders(template);
    return template;
  }
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawName: string) => {
    const varName = rawName.trim();
    const value = vars[varName];
    if (value === undefined) {
      throw new Error(`Missing prompt variable: ${varName}`);
    }
    return value;
  });
}

function loadPrompts(): Map<PromptName, string> {
  const promptDir = resolvePromptDir();
  const actualFiles = readdirSync(promptDir)
    .filter((file) => file.endsWith(".txt"))
    .sort();
  const expectedFiles = [...expectedPromptFiles].sort();
  if (actualFiles.join("\n") !== expectedFiles.join("\n")) {
    throw new Error(
      `Prompt files do not match PromptName union. Expected ${expectedFiles.join(
        ", ",
      )}; found ${actualFiles.join(", ")}`,
    );
  }
  return new Map(
    promptNames.map((name) => [
      name,
      readFileSync(join(promptDir, `${name}.txt` satisfies PromptFileName), "utf8"),
    ]),
  );
}

function resolvePromptDir(): string {
  const candidates = [
    join(process.cwd(), "prompts"),
    join(process.cwd(), "apps", "api", "prompts"),
    join(__dirname, "..", "..", "prompts"),
  ];
  const promptDir = candidates.find((candidate) => existsSync(candidate));
  if (!promptDir) {
    throw new Error("Prompt directory not found");
  }
  return promptDir;
}

function assertNoPlaceholders(template: string): void {
  const match = template.match(/\{\{\s*([^}]+?)\s*\}\}/);
  if (match) {
    throw new Error(`Missing prompt variable: ${match[1]!.trim()}`);
  }
}
