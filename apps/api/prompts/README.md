# API Prompts

`apps/api/prompts/` is the only place for runtime LLM prompt templates. Prompt files are sent to the model as-is, so do not add comments inside `.txt` files.

| File | Purpose | Caller | Placeholders | Last update reason |
| --- | --- | --- | --- | --- |
| `qa_answer.txt` | System prompt for retrieval-grounded QA answers. | `QaModule` via `readQaPrompt()` / `loadPrompt("qa_answer")` | None | Existing prompt kept byte-for-byte; E3 added loader ownership. |
| `proposal_requirement.txt` | Extracts structured proposal requirements from form fields and free text. | `ProposalModule` via `proposalRequirementPrompt` / `loadPrompt("proposal_requirement")` | None | Moved from `apps/api/src/proposal/proposal.prompt.ts` to block inline prompts. |
| `proposal_section.txt` | Generates one proposal section from requirement data and retrieved knowledge chunks. | `ProposalWorkerModule` via `proposalSectionPrompt` / `loadPrompt("proposal_section")` | None | Moved from `apps/api/src/proposal-worker/proposal-section.prompt.ts` to block inline prompts. |
