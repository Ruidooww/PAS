const DEFAULT_QA_KB_ID = "e0-mock-kb";

export function qaKbId(): string {
  return process.env.QA_KB_ID?.trim() || DEFAULT_QA_KB_ID;
}
