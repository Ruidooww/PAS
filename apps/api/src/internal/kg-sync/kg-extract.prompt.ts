import { loadPrompt } from "../../prompts/loader";

export const KG_EXTRACT_PROMPT = Symbol("KG_EXTRACT_PROMPT");
export const kgExtractPrompt = loadPrompt("kg_extract");
