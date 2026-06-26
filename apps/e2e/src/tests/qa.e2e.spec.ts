import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bootstrapE2e,
  resetE2eData,
  seedVisibleKnowledgeDocument,
  type E2eContext,
} from "../bootstrap";
import { loginWithMockIdp } from "../helpers/login";
import { parseSse } from "../helpers/sse";

describe("E5 smoke value line: QA", () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await bootstrapE2e();
    const { user } = await loginWithMockIdp(context.agent, context.prisma);
    await resetE2eData(context.prisma, user.uid);
    await seedVisibleKnowledgeDocument(context.prisma, user.uid);
  });

  afterAll(async () => {
    await context?.close();
  });

  it("logs in with mock IdP and streams delta, refs, and done from internal QA SSE", async () => {
    const response = await context.agent
      .post("/api/internal/qa")
      .set("accept", "text/event-stream")
      .send({
        query: "How should IP-Guard document encryption be configured?",
        sessionId: "e2e-qa-smoke",
      })
      .expect(200)
      .expect("content-type", /text\/event-stream/);

    const events = parseSse(response.text);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "delta", content: expect.stringContaining("Mock LLM answer") }),
    );
    expect(events).toContainEqual({
      type: "refs",
      refs: [expect.objectContaining({ n: 1, docName: "mock-document" })],
    });
    expect(events).toContainEqual({ type: "done" });
  });
});
