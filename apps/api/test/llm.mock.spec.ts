import { describe, expect, it } from "vitest";

import { LlmClientMock } from "../src/clients/llm";

describe("LlmClientMock", () => {
  it("adds a first citation when the supplied context contains a first source", async () => {
    const client = new LlmClientMock();

    await expect(
      client.complete({
        messages: [
          { role: "system", content: "sources:\n[1] Mock knowledge" },
          { role: "user", content: "How should this be configured?" },
        ],
      }),
    ).resolves.toBe("Mock LLM answer for: How should this be configured? [1]");
  });
});
