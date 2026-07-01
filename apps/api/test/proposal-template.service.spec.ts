import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TemplateService } from "../src/proposal/proposal-template.service";

describe("TemplateService", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a template section without promptTemplate", () => {
    const directory = createTemplateDirectory(`
id: invalid-template
name: Invalid
version: 1
product: IP-Guard
sections:
  - id: background
    title: Background
    retrievalIntent: No retrieval
    variables: []
`);

    expect(() => new TemplateService(directory).listTemplates()).toThrow(
      "Invalid proposal template: template.yaml",
    );
  });

  it("rejects duplicate template ids across configuration files", () => {
    const directory = createTemplateDirectory(validTemplate("duplicate-id"));
    writeFileSync(
      join(directory, "second.yaml"),
      validTemplate("duplicate-id"),
      "utf8",
    );

    expect(() => new TemplateService(directory).listTemplates()).toThrow(
      "Duplicate proposal template id: duplicate-id",
    );
  });

  it("loads both v1 and v2 templates from the checked-in config", () => {
    const directory = copyTemplateConfig();

    const templates = new TemplateService(directory).listTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "ip-guard-standard-v1",
      "ip-guard-standard-v2",
    ]);
  });

  it("loads v2 with 9 sections including module catalog and acceptance criteria", () => {
    const directory = copyTemplateConfig();

    const template = new TemplateService(directory).getTemplate("ip-guard-standard-v2");

    expect(template.sections).toHaveLength(9);
    expect(template.sections.map((section) => section.id)).toContain("module-catalog");
    expect(template.sections.map((section) => section.id)).toContain("acceptance-criteria");
  });

  function createTemplateDirectory(content: string): string {
    const directory = mkdtempSync(join(tmpdir(), "pas-proposal-templates-"));
    temporaryDirectories.push(directory);
    writeFileSync(join(directory, "template.yaml"), content, "utf8");
    return directory;
  }

  function copyTemplateConfig(): string {
    const directory = mkdtempSync(join(tmpdir(), "pas-proposal-templates-"));
    temporaryDirectories.push(directory);
    cpSync(resolve("config/proposal-templates"), directory, { recursive: true });
    return directory;
  }
});

function validTemplate(id: string): string {
  return `
id: ${id}
name: Valid
version: 1
product: IP-Guard
sections:
  - id: background
    title: Background
    retrievalIntent: No retrieval
    promptTemplate: Fill the background
    variables: []
    fixed: true
`;
}
