import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { bootstrapE2e, type E2eContext } from "../bootstrap";
import {
  cleanupExternalUser,
  externalSessionCookie,
  seedExternalUser,
} from "../helpers/external";

describe("E5 smoke value line: security regression", () => {
  let context: E2eContext;
  let cookie: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    context = await bootstrapE2e();
    await seedExternalUser(context.prisma);
    cookie = externalSessionCookie();
  });

  afterAll(async () => {
    warnSpy.mockRestore();
    await cleanupExternalUser(context.prisma);
    await context?.close();
  });

  it("rejects external sessions on internal APIs while allowing the public QA endpoint", async () => {
    await context.agent.get("/api/internal/customers").set("cookie", cookie).expect(403);
    await context.agent.get("/api/internal/proposals").set("cookie", cookie).expect(403);
    await context.agent.get("/api/internal/proposal-templates").set("cookie", cookie).expect(403);

    const publicQa = await context.agent
      .post("/api/public/qa")
      .set("cookie", cookie)
      .send({ query: "public question" })
      .expect(201);
    expect(publicQa.body).toEqual({
      answer: expect.stringContaining("Public mock answer"),
      sources: [expect.objectContaining({ documentId: "mock-document" })],
    });
  });
});
