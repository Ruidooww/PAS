import { describe, expect, it } from "vitest";

import { RagflowClientMock } from "../src/clients/ragflow";
import { DemoQaService } from "../src/demo/demo-qa.service";

describe("DemoQaService", () => {
  it("answers through the injected RAGFlow boundary", async () => {
    const service = new DemoQaService(new RagflowClientMock());

    await expect(service.ask("E0 能否并行开发？")).resolves.toMatchObject({
      answer: expect.stringContaining("E0 能否并行开发？"),
      sources: [{ documentId: "mock-document", score: 1 }],
    });
  });
});
