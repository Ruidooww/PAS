import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { Chunk } from "@pas/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LLM_CLIENT } from "../src/clients/llm";
import { RAGFLOW_CLIENT } from "../src/clients/ragflow";
import { AclService } from "../src/internal/acl.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TemplateService } from "../src/proposal/proposal-template.service";
import type { ProposalTemplate } from "../src/proposal/proposal-template.schema";
import { ProposalGenerationService } from "../src/proposal-worker/proposal-generation.service";
import { ProposalProgressService } from "../src/proposal-worker/proposal-progress.service";
import {
  PROPOSAL_SECTION_PROMPT,
  proposalSectionPrompt,
} from "../src/proposal-worker/proposal-section.prompt";

const job = {
  proposalId: "proposal-1",
  requirementJson: {
    customer: "ABC",
    industry: "manufacturing",
    scale: "500",
    needs: ["document encryption", "device control"],
    constraints: ["private deployment"],
  },
  templateId: "template-1",
  userId: "user-1",
};

const user = {
  id: "user-1",
  tenantId: "tenant-default",
  idpProvider: "mock",
  idpUserId: "mock-user-1",
  name: "Mock User",
  email: "mock@example.com",
  role: "presales",
  isExternal: false,
  deptId: "dept-presales",
};

describe("ProposalGenerationService", () => {
  const ragflowRetrieve = vi.fn();
  const llmComplete = vi.fn();
  const computeVisibleDocIds = vi.fn();
  const getTemplate = vi.fn();
  const proposalFindFirst = vi.fn();
  const proposalUpdateMany = vi.fn();
  const userFindUnique = vi.fn();
  const publish = vi.fn();
  let service: ProposalGenerationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    proposalFindFirst.mockResolvedValue({ status: "draft" });
    userFindUnique.mockResolvedValue(user);
    computeVisibleDocIds.mockResolvedValue(["allowed-doc"]);
    proposalUpdateMany.mockResolvedValue({ count: 1 });
    publish.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProposalGenerationService,
        {
          provide: RAGFLOW_CLIENT,
          useValue: { retrieve: ragflowRetrieve },
        },
        {
          provide: LLM_CLIENT,
          useValue: { complete: llmComplete },
        },
        {
          provide: AclService,
          useValue: { computeVisibleDocIds },
        },
        {
          provide: TemplateService,
          useValue: { getTemplate },
        },
        {
          provide: PrismaService,
          useValue: {
            proposal: { findFirst: proposalFindFirst, updateMany: proposalUpdateMany },
            user: { findUnique: userFindUnique },
          },
        },
        {
          provide: ProposalProgressService,
          useValue: { publish },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn((key: string) => {
              if (key === "PAS_KB_ID") return "proposal-kb";
              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
        {
          provide: PROPOSAL_SECTION_PROMPT,
          useValue: proposalSectionPrompt,
        },
      ],
    }).compile();

    service = moduleRef.get(ProposalGenerationService);
  });

  it("renders fixed chapters without retrieval or LLM calls", async () => {
    getTemplate.mockReturnValue(
      template([
        {
          id: "background",
          title: "Project background",
          retrievalIntent: "no retrieval",
          promptTemplate: "{{customer}} / {{industry}} / {{requirementJson}}",
          variables: ["customer", "industry", "requirementJson"],
          fixed: true,
        },
      ]),
    );

    await service.generate(job);

    expect(ragflowRetrieve).not.toHaveBeenCalled();
    expect(llmComplete).not.toHaveBeenCalled();
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        deletedAt: null,
        status: "draft",
      },
      data: {
        contentJson: {
          sections: [
            {
              id: "background",
              title: "Project background",
              body: expect.stringContaining("ABC / manufacturing"),
              refs: [],
            },
          ],
        },
        status: "draft_ready",
      },
    });
    expect(publish).toHaveBeenNthCalledWith(1, "proposal-1", {
      chapter: "background",
      n: 1,
      total: 1,
    });
    expect(publish).toHaveBeenNthCalledWith(2, "proposal-1", { done: true });
  });

  it("injects the ACL whitelist, excludes returned private chunks, and maps cited refs", async () => {
    getTemplate.mockReturnValue(
      template([
        {
          id: "overview",
          title: "Solution overview",
          retrievalIntent: "IP-Guard {{need}}",
          promptTemplate: "Design for {{requirementJson.needs[]}}",
          variables: ["requirementJson.needs[]"],
        },
      ]),
    );
    ragflowRetrieve.mockResolvedValue([
      chunk("allowed-chunk", "allowed-doc", "Allowed capability", {
        docName: "allowed.pdf",
        page: 7,
      }),
      chunk("private-chunk", "private-doc", "Private capability", {
        docName: "private.pdf",
        page: 9,
      }),
    ]);
    llmComplete.mockResolvedValue("Use the allowed capability [1]. Ignore [9].");

    await service.generate(job);

    expect(computeVisibleDocIds).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        role: "presales",
        deptId: "dept-presales",
      }),
    );
    expect(ragflowRetrieve).toHaveBeenCalledWith({
      query: expect.stringContaining("IP-Guard document encryption"),
      kbId: "proposal-kb",
      topK: 5,
      docIdWhitelist: ["allowed-doc"],
    });
    const completion = llmComplete.mock.calls[0]?.[0];
    expect(completion.messages[1].content).toContain("[1] Allowed capability");
    expect(completion.messages[1].content).not.toContain("Private capability");
    expect(completion.temperature).toBe(0.2);
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        deletedAt: null,
        status: "draft",
      },
      data: {
        contentJson: {
          sections: [
            {
              id: "overview",
              title: "Solution overview",
              body: "Use the allowed capability [1]. Ignore [9].",
              refs: [
                {
                  n: 1,
                  chunkId: "allowed-chunk",
                  docName: "allowed.pdf",
                  page: 7,
                },
              ],
            },
          ],
        },
        status: "draft_ready",
      },
    });
  });

  it("does not call retrieval when ACL returns no visible documents", async () => {
    computeVisibleDocIds.mockResolvedValue([]);
    getTemplate.mockReturnValue(
      template([
        {
          id: "overview",
          title: "Solution overview",
          retrievalIntent: "IP-Guard {{need}}",
          promptTemplate: "Design for {{need}}",
          variables: [],
        },
      ]),
    );
    llmComplete.mockResolvedValue("No grounded product claims.");

    await service.generate({
      ...job,
      requirementJson: { customer: "ABC" },
    });

    expect(ragflowRetrieve).not.toHaveBeenCalled();
    expect(llmComplete).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("[无可见知识片段]"),
        }),
      ],
      temperature: 0.2,
    });
  });

  it("fails the job without persisting duplicate sections when progress publish fails", async () => {
    getTemplate.mockReturnValue(
      template([
        {
          id: "background",
          title: "Project background",
          retrievalIntent: "no retrieval",
          promptTemplate: "{{customer}}",
          variables: ["customer"],
          fixed: true,
        },
      ]),
    );
    publish.mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(service.generate(job)).rejects.toThrow("Redis unavailable");
    expect(proposalUpdateMany).not.toHaveBeenCalled();
  });

  it("retries a failed chapter three times, reports the failure, and continues", async () => {
    getTemplate.mockReturnValue(
      template([
        {
          id: "failing",
          title: "Failing chapter",
          retrievalIntent: "first",
          promptTemplate: "first",
          variables: [],
        },
        {
          id: "following",
          title: "Following chapter",
          retrievalIntent: "second",
          promptTemplate: "second",
          variables: [],
        },
      ]),
    );
    ragflowRetrieve.mockResolvedValue([
      chunk("allowed-chunk", "allowed-doc", "Allowed capability", {
        docName: "allowed.pdf",
      }),
    ]);
    llmComplete
      .mockRejectedValueOnce(new Error("LLM unavailable"))
      .mockRejectedValueOnce(new Error("LLM unavailable"))
      .mockRejectedValueOnce(new Error("LLM unavailable"))
      .mockRejectedValueOnce(new Error("LLM unavailable"))
      .mockResolvedValueOnce("Following chapter [1]");

    await service.generate(job);

    expect(llmComplete).toHaveBeenCalledTimes(5);
    expect(proposalUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proposal-1",
        deletedAt: null,
        status: "draft",
      },
      data: {
        contentJson: {
          sections: [
            {
              id: "failing",
              title: "Failing chapter",
              body: "",
              refs: [],
            },
            {
              id: "following",
              title: "Following chapter",
              body: "Following chapter [1]",
              refs: [
                {
                  n: 1,
                  chunkId: "allowed-chunk",
                  docName: "allowed.pdf",
                },
              ],
            },
          ],
        },
        status: "draft_ready",
      },
    });
    expect(publish).toHaveBeenNthCalledWith(1, "proposal-1", {
      chapter: "failing",
      n: 1,
      total: 2,
      errorMessage: "LLM unavailable",
    });
    expect(publish).toHaveBeenNthCalledWith(2, "proposal-1", {
      chapter: "following",
      n: 2,
      total: 2,
    });
    expect(publish).toHaveBeenNthCalledWith(3, "proposal-1", { done: true });
  });

  it("skips duplicate jobs for proposals that are no longer draft", async () => {
    proposalFindFirst.mockResolvedValueOnce({ status: "draft_ready" });

    await service.generate(job);

    expect(getTemplate).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(ragflowRetrieve).not.toHaveBeenCalled();
    expect(llmComplete).not.toHaveBeenCalled();
    expect(proposalUpdateMany).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith("proposal-1", {
      done: true,
      errorMessage: "Proposal is no longer eligible for generation result",
    });
  });

  it("does not overwrite a finalized, non-draft, or soft-deleted proposal when CAS write loses", async () => {
    getTemplate.mockReturnValue(
      template([
        {
          id: "background",
          title: "Project background",
          retrievalIntent: "no retrieval",
          promptTemplate: "{{customer}}",
          variables: ["customer"],
          fixed: true,
        },
      ]),
    );
    proposalUpdateMany.mockResolvedValueOnce({ count: 0 });

    await service.generate(job);

    expect(publish).toHaveBeenNthCalledWith(2, "proposal-1", {
      done: true,
      errorMessage: "Proposal is no longer eligible for generation result",
    });
  });
});

function template(sections: ProposalTemplate["sections"]): ProposalTemplate {
  return {
    id: "template-1",
    name: "Template",
    version: 1,
    product: "IP-Guard",
    sections,
  };
}

function chunk(
  id: string,
  documentId: string,
  content: string,
  metadata: Record<string, unknown>,
): Chunk {
  return {
    id,
    documentId,
    content,
    score: 1,
    metadata,
  };
}
