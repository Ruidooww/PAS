import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionClaims } from "../src/auth/types";
import type { RagflowClient } from "../src/clients/ragflow";
import type { AclService } from "../src/internal/acl.service";
import { InternalQaService } from "../src/internal/qa/internal-qa.service";

const user: SessionClaims = {
  uid: "user-1",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "mock-user-1",
  name: "Mock User",
  email: "mock.presales@example.com",
  role: "presales",
  isExternal: false,
  deptId: "dept-presales",
};

function ragflowClient(retrieve = vi.fn(), chat = vi.fn(async function* () {
  yield "acl answer";
})): RagflowClient {
  return {
    retrieve,
    chat,
    graphQuery: vi.fn(),
    listDocs: vi.fn(),
    uploadDoc: vi.fn(),
  } as unknown as RagflowClient;
}

describe("InternalQaService ACL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses QA_KB_ID from the environment for retrieve and chat", async () => {
    vi.stubEnv("QA_KB_ID", "real-ragflow-dataset");
    const retrieve = vi.fn().mockResolvedValue([]);
    const chat = vi.fn(async function* () {
      yield "answer";
    });
    const acl = {
      computeVisibleDocIds: vi.fn().mockResolvedValue(["doc-visible"]),
    } as unknown as AclService;
    const service = new InternalQaService(ragflowClient(retrieve, chat), acl);

    await service.ask("configured KB", user);

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: "real-ragflow-dataset" }),
      user,
    );
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: "real-ragflow-dataset" }),
    );
  });

  it("passes visible document ids into retrieval and filters returned chunks as a fallback", async () => {
    const retrieve = vi.fn().mockResolvedValue([
      { id: "chunk-1", documentId: "doc-visible", content: "allowed", score: 0.9, metadata: {} },
      { id: "chunk-2", documentId: "doc-hidden", content: "denied", score: 0.8, metadata: {} },
    ]);
    const acl = {
      computeVisibleDocIds: vi.fn().mockResolvedValue(["doc-visible"]),
    } as unknown as AclService;
    const service = new InternalQaService(ragflowClient(retrieve), acl);

    const answer = await service.ask("acl question", user);

    expect(acl.computeVisibleDocIds).toHaveBeenCalledWith(user);
    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ query: "acl question", docIdWhitelist: ["doc-visible"] }),
      user,
    );
    expect(answer.sources).toEqual([{ documentId: "doc-visible", score: 0.9 }]);
  });

  it("does not retrieve from RAGFlow when no documents are visible", async () => {
    const retrieve = vi.fn();
    const acl = { computeVisibleDocIds: vi.fn().mockResolvedValue([]) } as unknown as AclService;
    const service = new InternalQaService(ragflowClient(retrieve), acl);

    await expect(service.ask("acl question", user)).resolves.toEqual({ answer: "", sources: [] });
    expect(retrieve).not.toHaveBeenCalled();
  });
});
