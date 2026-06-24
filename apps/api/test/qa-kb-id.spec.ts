import { afterEach, describe, expect, it, vi } from "vitest";

import { qaKbId } from "../src/qa/qa-kb-id";

describe("qaKbId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["", "   "])("uses the default for an empty QA_KB_ID value", (value) => {
    vi.stubEnv("QA_KB_ID", value);

    expect(qaKbId()).toBe("e0-mock-kb");
  });

  it("trims a configured QA_KB_ID", () => {
    vi.stubEnv("QA_KB_ID", "  real-ragflow-dataset  ");

    expect(qaKbId()).toBe("real-ragflow-dataset");
  });
});
