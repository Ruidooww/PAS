import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bootstrapE2e,
  resetE2eData,
  seedVisibleKnowledgeDocument,
  type E2eContext,
} from "../bootstrap";
import { loginWithMockIdp } from "../helpers/login";
import { pollUntil } from "../helpers/poll";

interface CustomerListResponse {
  items: Array<{ ref: string; name: string; industry: string | null; scale: number | null }>;
}

interface ProposalTemplateSummary {
  id: string;
  name: string;
}

interface ProposalDetail {
  id: string;
  contentJson: null | { sections: Array<{ title: string; body: string; refs: unknown[] }> };
}

type SupertestParser = Parameters<ReturnType<E2eContext["agent"]["get"]>["parse"]>[0];

describe("E5 smoke value line: proposal generation", () => {
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

  it("creates a requirement from mock CRM data, generates sections, and exports docx", async () => {
    const customers = (await context.agent
      .get("/api/internal/customers")
      .expect(200)).body as CustomerListResponse;
    const customer = customers.items[0];
    if (!customer) throw new Error("Expected at least one mock CRM customer");
    expect(customer).toEqual(expect.objectContaining({ ref: expect.any(String) }));

    const templates = (await context.agent
      .get("/api/internal/proposal-templates")
      .expect(200)).body as ProposalTemplateSummary[];
    const template = templates[0];
    if (!template) throw new Error("Expected at least one proposal template");
    expect(template).toEqual(expect.objectContaining({ id: expect.any(String) }));

    const draft = await context.agent
      .post("/api/internal/proposals/draft-requirement")
      .send({
        formFields: {
          customerName: customer.name,
          industry: customer.industry ?? "information security",
          scale: `${customer.scale ?? 500} endpoints`,
          needs: ["document encryption"],
          constraints: ["private deployment"],
        },
      })
      .expect(200);
    const proposalId = (draft.body as { id?: unknown }).id;
    expect(proposalId).toEqual(expect.any(String));

    await context.agent
      .post(`/api/internal/proposals/${proposalId}/generate`)
      .send({ templateId: template.id })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({ proposalId, status: "queued" });
      });

    const generated = await pollUntil(
      async () =>
        (await context.agent
          .get(`/api/internal/proposals/${proposalId}`)
          .expect(200)).body as ProposalDetail,
      (proposal) => proposal.contentJson !== null,
    );
    expect(generated.contentJson?.sections.length).toBeGreaterThan(0);

    const docx = await context.agent
      .get(`/api/internal/proposals/${proposalId}/export?format=docx`)
      .buffer(true)
      .parse(binaryParser as unknown as SupertestParser)
      .expect(200)
      .expect(
        "content-type",
        /application\/vnd.openxmlformats-officedocument.wordprocessingml.document/,
      );
    expect(Number(docx.headers["content-length"])).toBeGreaterThan(1000);
    expect(Buffer.isBuffer(docx.body)).toBe(true);
    expect((docx.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    writeDocxArtifact(docx.body as Buffer);
  });
});

function writeDocxArtifact(buffer: Buffer): void {
  const outputDir = join(process.cwd(), "test-results");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "proposal-smoke.docx"), buffer);
}

function binaryParser(
  response: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on("end", () => {
    callback(null, Buffer.concat(chunks));
  });
}
