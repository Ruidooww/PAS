import { describe, expect, it } from "vitest";

import { AgentClientMock } from "../src/clients/agent";

describe("AgentClientMock", () => {
  it("returns a mock-tagged result echoing input keys + identity", async () => {
    const client = new AgentClientMock();
    const result = await client.runWorkflow({
      workflowId: "wf-proposal-chapter",
      inputs: { chapterId: "intro", retrievalIntent: "IP-Guard 架构" },
      identity: { pasUserId: "u1", tenantId: "t1", customerId: "c1" },
    });

    expect(result.isMock).toBe(true);
    expect(result.workflowId).toBe("wf-proposal-chapter");
    expect(result.output).toMatchObject({
      mock: true,
      echoedInputKeys: ["chapterId", "retrievalIntent"],
      identity: { pasUserId: "u1", tenantId: "t1", customerId: "c1" },
    });
  });

  it("throws when identity is missing required fields", async () => {
    const client = new AgentClientMock();
    await expect(
      client.runWorkflow({
        workflowId: "wf",
        inputs: {},
        // @ts-expect-error — intentionally violate the contract
        identity: { pasUserId: "u1" },
      }),
    ).rejects.toThrow(/identity/);
  });

  it("accepts optional customerId (null when omitted)", async () => {
    const client = new AgentClientMock();
    const result = await client.runWorkflow({
      workflowId: "wf",
      inputs: {},
      identity: { pasUserId: "u1", tenantId: "t1" },
    });
    expect(result.output).toMatchObject({
      identity: { customerId: null },
    });
  });
});
