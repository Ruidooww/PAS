import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const tempDirs: string[] = [];
const cwdParts = originalCwd.split(/[\\/]/);
const apiRoot = cwdParts.slice(-2).join("/") === "apps/api"
  ? originalCwd
  : join(originalCwd, "apps", "api");

async function importFreshLoader() {
  vi.resetModules();
  return import("./loader");
}

function useTempPrompts(content: string): void {
  const dir = mkdtempSync(join(tmpdir(), "pas-prompts-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, "prompts"));
  writeFileSync(join(dir, "prompts", "kg_extract.txt"), "KG extract\n", "utf8");
  writeFileSync(join(dir, "prompts", "qa_answer.txt"), content, "utf8");
  writeFileSync(join(dir, "prompts", "proposal_requirement.txt"), "Requirement\n", "utf8");
  writeFileSync(join(dir, "prompts", "proposal_section.txt"), "Section\n", "utf8");
  process.chdir(dir);
}

describe("loadPrompt", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads the existing qa_answer prompt byte-for-byte", async () => {
    const { loadPrompt } = await importFreshLoader();
    const expected = readFileSync(
      join(apiRoot, "prompts", "qa_answer.txt"),
      "utf8",
    );

    expect(loadPrompt("qa_answer")).toBe(expected);
  });

  it("reads the KG extraction prompt byte-for-byte", async () => {
    const { loadPrompt } = await importFreshLoader();
    const expected = readFileSync(
      join(apiRoot, "prompts", "kg_extract.txt"),
      "utf8",
    );

    expect(loadPrompt("kg_extract")).toBe(expected);
  });

  it("replaces {{customer}} variables", async () => {
    useTempPrompts("Hello {{customer}}\n");
    const { loadPrompt } = await importFreshLoader();

    expect(loadPrompt("qa_answer", { customer: "Acme" })).toBe("Hello Acme\n");
  });

  it("throws when a placeholder variable is missing", async () => {
    useTempPrompts("Hello {{customer}}\n");
    const { loadPrompt } = await importFreshLoader();

    expect(() => loadPrompt("qa_answer")).toThrow(/Missing prompt variable: customer/);
  });
});
