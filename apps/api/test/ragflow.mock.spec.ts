import { describe, expect, it } from "vitest";

import { type RagflowAclUserClaims, RagflowClientMock } from "../src/clients/ragflow";

const userClaims: RagflowAclUserClaims = {
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

describe("RagflowClientMock", () => {
  it("returns a deterministic chunk for retrieval", async () => {
    const client = new RagflowClientMock();

    const chunks = await client.retrieve({ kbId: "kb-e0", query: "濡備綍閰嶇疆鍔犲瘑绛栫暐" }, userClaims);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ documentId: "mock-document", score: 1 });
    expect(chunks[0]?.content).toContain("濡備綍閰嶇疆鍔犲瘑绛栫暐");
  });

  it("streams a deterministic mock answer", async () => {
    const client = new RagflowClientMock();
    const tokens: string[] = [];

    for await (const token of client.chat({
      kbId: "kb-e0",
      messages: [{ role: "user", content: "娴嬭瘯闂" }],
    })) {
      tokens.push(token);
    }

    expect(tokens.join("")).toContain("娴嬭瘯闂");
  });
});
