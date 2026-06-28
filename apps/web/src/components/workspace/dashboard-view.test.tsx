import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CustomerSummary, OpportunitySummary } from "../../lib/crm/types";
import type { Proposal } from "../../lib/proposal/types";
import { DashboardContent } from "./dashboard-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const customers: CustomerSummary[] = [
  {
    ref: "cust-1",
    name: "海天精工股份有限公司",
    industry: "高端装备制造",
    scale: 5800,
    ownerId: "zhangwei",
    source: "mock",
  },
];

const opportunities: OpportunitySummary[] = [
  {
    ref: "opp-1",
    customerRef: "cust-1",
    title: "智能制造平台项目",
    stage: "方案设计",
    amountEstimate: 18_600_000,
    ownerId: "zhangwei",
  },
];

const proposals: Proposal[] = [
  {
    id: "proposal-1",
    customerRef: "cust-1",
    title: "智能制造平台项目解决方案",
    status: "draft_ready",
    requirementJson: {
      customer: "海天精工股份有限公司",
      industry: "高端装备制造",
      scale: "员工 5,800+",
      needs: [],
      constraints: [],
    },
    contentJson: null,
    version: 2,
    createdAt: "2026-06-20T00:00:00.000Z",
    deletedAt: null,
  },
];

describe("DashboardContent", () => {
  it("renders KPI cards, recent opportunities, proposal progress, and side updates", () => {
    const html = renderToStaticMarkup(
      <DashboardContent
        customers={customers}
        opportunities={opportunities}
        proposals={proposals}
        today={new Date("2026-06-28T10:00:00.000Z")}
      />,
    );

    expect(html.match(/data-dashboard-metric=/g)).toHaveLength(4);
    expect(html).toContain("待跟进商机数");
    expect(html).toContain("进行中方案");
    expect(html).toContain("本月生成");
    expect(html).toContain("反馈正向率");
    expect(html).toContain("智能制造平台项目");
    expect(html).toContain("智能制造平台项目解决方案");
    expect(html).toContain("知识库快讯");
    expect(html).toContain("待办");
  });
});
