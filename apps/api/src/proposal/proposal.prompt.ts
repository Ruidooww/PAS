import { loadPrompt } from "../prompts/loader";

export const PROPOSAL_PROMPT = Symbol("PROPOSAL_PROMPT");

export const proposalRequirementPrompt = loadPrompt("proposal_requirement");
