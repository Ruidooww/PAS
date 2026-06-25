import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  function createTemplateDirectory(content: string): string {
    const directory = mkdtempSync(join(tmpdir(), "pas-proposal-templates-"));
    temporaryDirectories.push(directory);
    writeFileSync(join(directory, "template.yaml"), content, "utf8");
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
