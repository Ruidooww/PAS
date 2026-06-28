import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CustomerDetail, OpportunitySummary } from "../../lib/crm/types";
import type { Proposal, ProposalVersionRecord } from "../../lib/proposal/types";
import { ProposalWorkspaceContent } from "./proposal-workspace-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const proposal: Proposal = {
  id: "proposal-1",
  customerRef: "cust-1",
  title: "智能制造平台项目解决方案",
  status: "draft_ready",
  requirementJson: {
    customer: "海天精工股份有限公司",
    industry: "高端装备制造",
    scale: "员工 5,800+",
    needs: ["打通生产、质量、设备数据", "建立统一制造运营平台"],
    constraints: ["满足合规要求"],
  },
  contentJson: {
    sections: [
      {
        id: "background",
        title: "项目背景",
        body: "客户需要统一生产、质量与设备数据。",
        refs: [{ n: 1, docName: "智能制造平台建设白皮书", page: 12 }],
      },
      {
        id: "goals",
        title: "建设目标",
        body: "提升多工厂协同与生产透明度。",
        refs: [],
      },
    ],
  },
  version: 2,
  createdAt: "2026-06-28T09:00:00.000Z",
  deletedAt: null,
};

const customer: CustomerDetail = {
  ref: "cust-1",
  name: "海天精工股份有限公司",
  industry: "高端装备制造",
  scale: 5800,
  ownerId: "zhangwei",
  source: "mock",
  syncedAt: "2026-06-28T08:00:00.000Z",
  proposals: [],
};

const opportunity: OpportunitySummary = {
  ref: "opp-1",
  customerRef: "cust-1",
  title: "智能制造平台项目",
  stage: "方案设计",
  amountEstimate: 18_600_000,
  ownerId: "zhangwei",
};

const versions: ProposalVersionRecord[] = [
  {
    id: "version-1",
    proposalId: "proposal-1",
    version: 2,
    contentJson: proposal.contentJson,
    createdAt: "2026-06-28T09:20:00.000Z",
  },
];

describe("ProposalWorkspaceContent", () => {
  it("renders a three-column proposal workspace with section tabs and references", () => {
    const html = renderToStaticMarkup(
      <ProposalWorkspaceContent
        activeSectionId="background"
        assistant={<div data-testid="assistant">AI assistant</div>}
        customer={customer}
        editing={{}}
        onActiveSectionChange={() => undefined}
        onCancelEdit={() => undefined}
        onDraftChange={() => undefined}
        onSaveSection={() => undefined}
        proposal={proposal}
        savingSectionId={null}
        versions={versions}
        opportunities={[opportunity]}
      />,
    );

    expect(html).toContain('data-workspace-column="context"');
    expect(html).toContain('data-workspace-column="editor"');
    expect(html).toContain('data-workspace-column="assistant"');
    expect(html.match(/data-section-tab=/g)).toHaveLength(2);
    expect(html).toContain("海天精工股份有限公司");
    expect(html).toContain("智能制造平台项目");
    expect(html).toContain("项目背景");
    expect(html).toContain("客户需要统一生产、质量与设备数据。");
    expect(html).toContain("智能制造平台建设白皮书");
    expect(html).toContain("AI assistant");
  });
});
