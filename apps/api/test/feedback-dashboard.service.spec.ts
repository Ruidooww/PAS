import { describe, expect, it, vi } from "vitest";

import {
  FeedbackDashboardService,
  isRefusalMessage,
  normalizeTopDownQueryRows,
} from "../src/internal/admin/feedback-dashboard.service";

describe("FeedbackDashboardService", () => {
  it("centralizes the refusal SQL condition", () => {
    const condition = isRefusalMessage() as unknown as { strings: string[] };

    expect(condition.strings.join("")).toBe('(m."refs" IS NULL OR jsonb_array_length(m."refs") = 0)');
  });

  it("normalizes top down query rows by count descending", () => {
    const rows = [
      { query: "How do I configure audit export?", downCount: 1 },
      { query: "How do I configure encryption?", downCount: 3 },
      { query: "How do I configure backup?", downCount: 2 },
      { query: "How do I configure DLP?", downCount: 1 },
      { query: "How do I configure SSO?", downCount: 1 },
      { query: "How do I configure endpoint control?", downCount: 1 },
    ];

    expect(normalizeTopDownQueryRows(rows)).toEqual([
      { query: "How do I configure encryption?", downCount: 3 },
      { query: "How do I configure backup?", downCount: 2 },
      { query: "How do I configure audit export?", downCount: 1 },
      { query: "How do I configure DLP?", downCount: 1 },
      { query: "How do I configure endpoint control?", downCount: 1 },
      { query: "How do I configure SSO?", downCount: 1 },
    ]);
  });

  it("aggregates assistant messages, feedback, refusal count, top down queries, and daily usage", async () => {
    const prisma = {
      message: {
        count: vi.fn().mockResolvedValue(6),
      },
      conversationFeedback: {
        count: vi.fn(async ({ where }: { where: { rating?: "up" | "down" } }) =>
          where.rating === "up" ? 3 : 2,
        ),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ count: 1n }])
        .mockResolvedValueOnce([
          { query: "How do I configure encryption?", downCount: 2n },
          { query: "How do I configure backup?", downCount: 1n },
        ])
        .mockResolvedValueOnce([{ date: "2026-06-01", count: 4n }]),
    };
    const service = new FeedbackDashboardService(prisma as never);

    const result = await service.getDashboard({
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-02T23:59:59.999Z"),
    });

    expect(result).toEqual({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-02T23:59:59.999Z",
      },
      totals: {
        qaCount: 6,
        upCount: 3,
        downCount: 2,
        refusalCount: 1,
      },
      rates: {
        upRate: 0.5,
        downRate: 0.3333,
        refusalRate: 0.1667,
      },
      topDownQueries: [
        { query: "How do I configure encryption?", downCount: 2 },
        { query: "How do I configure backup?", downCount: 1 },
      ],
      dailyUsage: [
        { date: "2026-06-01", count: 4 },
        { date: "2026-06-02", count: 0 },
      ],
    });
  });
});
