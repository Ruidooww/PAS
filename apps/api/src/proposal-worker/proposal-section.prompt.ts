import { loadPrompt } from "../prompts/loader";

export const PROPOSAL_SECTION_PROMPT = Symbol("PROPOSAL_SECTION_PROMPT");

export const proposalSectionPrompt = loadPrompt("proposal_section");
