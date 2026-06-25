import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { Inject, Injectable } from "@nestjs/common";
import { parse } from "yaml";

import {
  type ProposalTemplate,
  proposalTemplateSchema,
} from "./proposal-template.schema";

export const PROPOSAL_TEMPLATE_DIRECTORY = Symbol("PROPOSAL_TEMPLATE_DIRECTORY");

@Injectable()
export class TemplateService {
  private templates?: ProposalTemplate[];

  constructor(
    @Inject(PROPOSAL_TEMPLATE_DIRECTORY) private readonly templateDirectory: string,
  ) {}

  listTemplates(): ProposalTemplate[] {
    this.templates ??= loadTemplates(this.templateDirectory);
    return this.templates;
  }

  getTemplate(id: string): ProposalTemplate {
    const template = this.listTemplates().find((candidate) => candidate.id === id);
    if (!template) throw new Error(`Proposal template not found: ${id}`);
    return template;
  }
}

export function resolveProposalTemplateDirectory(): string {
  const candidates = [
    join(process.cwd(), "config", "proposal-templates"),
    join(process.cwd(), "apps", "api", "config", "proposal-templates"),
    join(__dirname, "..", "config", "proposal-templates"),
    join(__dirname, "..", "..", "config", "proposal-templates"),
  ];
  const directory = candidates.find((candidate) => existsSync(candidate));
  if (!directory) throw new Error("Proposal template directory not found");
  return directory;
}

function loadTemplates(directory: string): ProposalTemplate[] {
  const templateFiles = readdirSync(directory)
    .filter((fileName) => [".yaml", ".yml"].includes(extname(fileName).toLowerCase()))
    .sort();
  if (templateFiles.length === 0) {
    throw new Error(`No proposal templates found in ${directory}`);
  }

  const templates = templateFiles.map((fileName) => {
    const path = join(directory, fileName);
    try {
      return proposalTemplateSchema.parse(parse(readFileSync(path, "utf8")));
    } catch (error) {
      throw new Error(`Invalid proposal template: ${fileName}`, { cause: error });
    }
  });

  const templateIds = new Set<string>();
  for (const template of templates) {
    if (templateIds.has(template.id)) {
      throw new Error(`Duplicate proposal template id: ${template.id}`);
    }
    templateIds.add(template.id);
  }
  return templates;
}
