import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  WORKSHOP_VIEW_IDS,
  WorkshopViewContent,
  isDynamicView,
  type WorkshopViewConfig,
} from "./workshop-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const config: WorkshopViewConfig = {
  id: "customers",
  title: "客户画像",
  description: "查看客户组织、行业、数字化阶段和历史方案记录。",
  metric: { value: "238", label: "客户总数" },
  cards: [
    { label: "战略客户", value: "42" },
    { label: "本月新增", value: "16" },
    { label: "待补全画像", value: "9" },
  ],
  columns: ["客户", "行业", "阶段", "负责人"],
  emptyText: "暂无客户数据",
  sideTitle: "客户摘要",
  sideItems: [
    { title: "客户摘要", body: "核心诉求集中在生产透明度和多工厂协同。" },
  ],
};

describe("WorkshopView", () => {
  it("registers every phase 4 view id", () => {
    expect(WORKSHOP_VIEW_IDS).toEqual([
      "customers",
      "opportunities",
      "documents",
      "knowledge",
      "qa",
      "analytics",
      "tasks",
    ]);
  });

  it("loads knowledge as a dynamic view", () => {
    expect(isDynamicView("knowledge")).toBe(true);
  });

  it("renders the generic workshop view contract", () => {
    const html = renderToStaticMarkup(
      <WorkshopViewContent
        config={config}
        rows={[
          {
            id: "cust-1",
            cells: ["海天精工股份有限公司", "高端装备制造", "方案设计", "张伟"],
          },
        ]}
      />,
    );

    expect(html).toContain('data-workshop-view="customers"');
    expect(html.match(/data-workshop-card=/g)).toHaveLength(3);
    expect(html).toContain("客户画像");
    expect(html).toContain("海天精工股份有限公司");
    expect(html).toContain("客户摘要");
  });
});
