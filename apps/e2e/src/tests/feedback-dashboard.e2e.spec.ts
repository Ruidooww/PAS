import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bootstrapE2e,
  resetE2eData,
  type E2eContext,
} from "../bootstrap";
import { loginAsAdmin } from "../helpers/login";

describe("E5 smoke value line: feedback dashboard", () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await bootstrapE2e();
    const { user } = await loginAsAdmin(context.agent, context.prisma);
    await resetE2eData(context.prisma, user.uid);
    await seedFeedbackDashboardData(context, user.uid);
  });

  afterAll(async () => {
    await context?.close();
  });

  it("allows an admin to read the aggregate feedback dashboard", async () => {
    const response = await context.agent
      .get(
        "/api/internal/admin/feedback-dashboard?from=2026-06-01T00:00:00.000Z&to=2026-06-03T23:59:59.999Z",
      )
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        range: {
          from: "2026-06-01T00:00:00.000Z",
          to: "2026-06-03T23:59:59.999Z",
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
      }),
    );
    expect(response.body.topDownQueries[0]).toEqual({
      query: "How should encryption be configured?",
      downCount: 2,
    });
    expect(response.body.dailyUsage).toEqual([
      { date: "2026-06-01", count: 2 },
      { date: "2026-06-02", count: 3 },
      { date: "2026-06-03", count: 1 },
    ]);
  });
});

async function seedFeedbackDashboardData(context: E2eContext, userId: string): Promise<void> {
  const conversation = await context.prisma.conversation.create({
    data: {
      sessionId: "e2e-feedback-dashboard",
      userId,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    select: { id: true },
  });
  const assistantMessages: string[] = [];
  const entries = [
    { query: "How should encryption be configured?", rating: "down" as const, day: "2026-06-01" },
    { query: "How should encryption be configured?", rating: "down" as const, day: "2026-06-01" },
    { query: "How do I enable audit export?", rating: "up" as const, day: "2026-06-02" },
    { query: "How do I enable DLP?", rating: "up" as const, day: "2026-06-02" },
    { query: "How do I configure SSO?", rating: "up" as const, day: "2026-06-02" },
  ];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const userCreatedAt = new Date(`${entry.day}T0${index}:00:00.000Z`);
    const assistantCreatedAt = new Date(`${entry.day}T0${index}:05:00.000Z`);
    await context.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: entry.query,
        createdAt: userCreatedAt,
      },
    });
    const assistant = await context.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: `Answer ${index + 1}`,
        refs: [{ n: 1, docName: "E2E Doc" }],
        createdAt: assistantCreatedAt,
      },
      select: { id: true },
    });
    assistantMessages.push(assistant.id);
    await context.prisma.conversationFeedback.create({
      data: {
        userId,
        messageId: assistant.id,
        rating: entry.rating,
        createdAt: assistantCreatedAt,
      },
    });
  }

  await context.prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: "What is the unsupported policy?",
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
    },
  });
  await context.prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: "No matching source was found.",
      refs: [],
      createdAt: new Date("2026-06-03T00:05:00.000Z"),
    },
  });
  expect(assistantMessages).toHaveLength(5);
}
