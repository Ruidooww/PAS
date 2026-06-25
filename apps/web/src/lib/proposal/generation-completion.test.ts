import { describe, expect, it, vi } from "vitest";

import * as proposalApi from "./api-client";
import type { Proposal } from "./types";

type WaitForGeneratedProposal = (
  proposalId: string,
  options: {
    load: (proposalId: string) => Promise<Proposal>;
    onProposal: (proposal: Proposal) => void;
    wait: () => Promise<void>;
  },
) => Promise<Proposal>;

describe("waitForGeneratedProposal", () => {
  it("recovers from a missing SSE done event by polling persisted proposal state", async () => {
    const waitForGeneratedProposal = (
      proposalApi as typeof proposalApi & {
        waitForGeneratedProposal?: WaitForGeneratedProposal;
      }
    ).waitForGeneratedProposal;

    expect(waitForGeneratedProposal).toBeTypeOf("function");
    if (!waitForGeneratedProposal) return;

    const draft = proposal({ status: "draft", contentJson: null });
    const generated = proposal({
      status: "draft_ready",
      contentJson: {
        sections: [
          {
            id: "project-background",
            title: "项目背景",
            body: "已生成",
            refs: [],
          },
        ],
      },
    });
    const load = vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce(generated);
    const onProposal = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForGeneratedProposal("proposal-1", { load, onProposal, wait }),
    ).resolves.toEqual(generated);
    expect(load).toHaveBeenCalledTimes(2);
    expect(onProposal).toHaveBeenNthCalledWith(1, draft);
    expect(onProposal).toHaveBeenNthCalledWith(2, generated);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});

function proposal(overrides: Partial<Proposal>): Proposal {
  return {
    id: "proposal-1",
    customerRef: "customer-1",
    title: "方案",
    status: "draft",
    requirementJson: {
      customer: "客户",
      industry: "制造业",
      scale: "100",
      needs: [],
      constraints: [],
    },
    contentJson: null,
    version: 1,
    createdAt: "2026-06-26T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}
