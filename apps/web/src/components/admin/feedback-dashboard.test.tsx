import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  buildLinePath,
  FeedbackDashboardContent,
  fetchFeedbackDashboard,
  type FeedbackDashboardPayload,
} from "./feedback-dashboard";

const payload: FeedbackDashboardPayload = {
  range: {
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-30T23:59:59.999Z",
  },
  totals: {
    qaCount: 120,
    upCount: 72,
    downCount: 18,
    refusalCount: 6,
  },
  rates: {
    upRate: 0.6,
    downRate: 0.15,
    refusalRate: 0.05,
  },
  topDownQueries: Array.from({ length: 10 }, (_, index) => ({
    query: `Query ${index + 1}`,
    downCount: 10 - index,
  })),
  dailyUsage: Array.from({ length: 30 }, (_, index) => ({
    date: `2026-06-${String(index + 1).padStart(2, "0")}`,
    count: index + 1,
  })),
};

describe("FeedbackDashboard", () => {
  it("fetches the feedback dashboard payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchFeedbackDashboard()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/internal/admin/feedback-dashboard", {
      credentials: "include",
      headers: { accept: "application/json" },
    });

    vi.unstubAllGlobals();
  });

  it("renders stat cards, svg line path, and ten table rows", () => {
    const html = renderToStaticMarkup(
      <FeedbackDashboardContent data={payload} expandedQuery={null} onToggleQuery={() => undefined} />,
    );

    expect(html).toContain("总问答数");
    expect(html).toContain("赞同率");
    expect(html).toContain("点踩率");
    expect(html).toContain("拒答率");
    expect(html).toContain("<svg");
    expect(html).toContain("<path");
    expect((html.match(/data-feedback-row=/g) ?? []).length).toBe(10);
  });

  it("builds an inline svg line path from usage points", () => {
    expect(buildLinePath(payload.dailyUsage, 300, 120)).toMatch(/^M /);
  });
});
