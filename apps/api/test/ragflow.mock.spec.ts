import { describe, expect, it } from "vitest";

import { RagflowClientMock } from "../src/clients/ragflow";

describe("RagflowClientMock", () => {
  it("returns a deterministic chunk for retrieval", async () => {
    const client = new RagflowClientMock();

    const chunks = await client.retrieve({ kbId: "kb-e0", query: "如何配置加密策略" });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ documentId: "mock-document", score: 1 });
    expect(chunks[0]?.content).toContain("如何配置加密策略");
  });

  it("streams a deterministic mock answer", async () => {
    const client = new RagflowClientMock();
    const tokens: string[] = [];

    for await (const token of client.chat({
      kbId: "kb-e0",
      messages: [{ role: "user", content: "测试问题" }],
    })) {
      tokens.push(token);
    }

    expect(tokens.join("")).toContain("测试问题");
  });
});
