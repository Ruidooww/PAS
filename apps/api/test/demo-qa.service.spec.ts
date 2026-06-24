import { afterEach, describe, expect, it, vi } from "vitest";

import { RagflowClientMock, type RagflowClient } from "../src/clients/ragflow";
import { DemoQaService } from "../src/demo/demo-qa.service";

describe("DemoQaService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses QA_KB_ID from the environment for retrieve and chat", async () => {
    vi.stubEnv("QA_KB_ID", "real-ragflow-dataset");
    const retrieve = vi.fn().mockResolvedValue([]);
    const chat = vi.fn(async function* () {
      yield "answer";
    });
    const client = {
      retrieve,
      chat,
      graphQuery: vi.fn(),
      listDocs: vi.fn(),
      uploadDoc: vi.fn(),
    } as unknown as RagflowClient;
    const service = new DemoQaService(client);

    await service.ask("configured KB");

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: "real-ragflow-dataset" }),
    );
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: "real-ragflow-dataset" }),
    );
  });

  it("answers through the injected RAGFlow boundary", async () => {
    const service = new DemoQaService(new RagflowClientMock());

    await expect(service.ask("E0 能否并行开发？")).resolves.toMatchObject({
      answer: expect.stringContaining("E0 能否并行开发？"),
      sources: [{ documentId: "mock-document", score: 1 }],
    });
  });
});
