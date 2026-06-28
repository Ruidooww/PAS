import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { AppShell, getVisibleNavLinks } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/proposals/demo/workspace",
}));

describe("AppShell", () => {
  it("renders the icon rail, theme toggle, and compatible page slots", () => {
    const html = renderToStaticMarkup(
      <AppShell
        pageTitle="方案工作室"
        pageDescription="三栏方案工作台"
        breadcrumb={[
          { label: "方案", href: "/proposals" },
          { label: "工作台" },
        ]}
        actions={<Link href="/proposals/new">新建方案</Link>}
      >
        <section data-testid="shell-child">正文区域</section>
      </AppShell>,
    );

    expect(html).toContain('aria-label="主导航"');
    expect(html.match(/data-shell-nav=/g)).toHaveLength(9);
    expect(html).toContain('data-shell-nav="proposal"');
    expect(html).toContain('data-shell-nav="analytics"');
    expect(html).toContain('data-shell-nav="tasks"');
    expect(html).toContain('data-shell-utility="settings"');
    expect(html).toContain('aria-label="切换主题"');
    expect(html).toContain("方案工作室");
    expect(html).toContain("三栏方案工作台");
    expect(html).toContain("新建方案");
    expect(html).toContain("正文区域");
  });

  it("does not include admin feedback nav for presales users", () => {
    expect(getVisibleNavLinks("presales").some((item) => item.id === "admin-feedback")).toBe(false);
  });

  it("includes admin feedback nav for admin users", () => {
    const adminFeedback = getVisibleNavLinks("admin").find((item) => item.id === "admin-feedback");

    expect(adminFeedback).toMatchObject({
      href: "/admin/feedback",
      id: "admin-feedback",
      label: "反馈看板",
    });
  });
});
