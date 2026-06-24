import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { RagflowClient } from "../src/clients/ragflow";
import { PUBLIC_RAGFLOW_CLIENT } from "../src/public/public-clients.module";
import { PublicQaController } from "../src/public/qa/public-qa.controller";
import { PublicQaService } from "../src/public/qa/public-qa.service";
import { redactExternalAnswer } from "../src/public/qa/redact-answer";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("redactExternalAnswer", () => {
  it("redacts phone numbers and email addresses in prose", () => {
    expect(redactExternalAnswer("联系 13800001111 或 alice@example.com")).toBe(
      "联系 138****1111 或 a***@example.com",
    );
  });

  it("preserves fenced code blocks byte for byte", () => {
    const fenced = "```text\r\n13800001111\r\nalice@example.com\r\n```";
    const answer = `正文 13800001111\n${fenced}\n结束`;
    const redacted = redactExternalAnswer(answer);

    expect(redacted).toContain(fenced);
    expect(redacted).toBe(`正文 138****1111\n${fenced}\n结束`);
  });

  it("preserves inline code byte for byte", () => {
    const inline = "`13800001111 alice@example.com`";
    expect(redactExternalAnswer(`配置 ${inline}，联系 13900002222`)).toBe(
      `配置 ${inline}，联系 139****2222`,
    );
  });

  it("does not redact at-signs inside markdown link destinations", () => {
    const link = "[联系支持](mailto:alice@example.com)";
    expect(redactExternalAnswer(`${link}，备用邮箱 bob@example.com`)).toBe(
      `${link}，备用邮箱 b***@example.com`,
    );
  });

  it("preserves citation tokens containing phone-like numbers", () => {
    expect(redactExternalAnswer("[ID:13800001111] [13800001111] 正文 13800001111")).toBe(
      "[ID:13800001111] [13800001111] 正文 138****1111",
    );
  });
});

describe("public QA answer redaction", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("removes plaintext PII from the public route answer", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicQaController],
      providers: [
        PublicQaService,
        {
          provide: PUBLIC_RAGFLOW_CLIENT,
          useValue: {
            retrieve: vi.fn().mockResolvedValue([]),
          } as unknown as RagflowClient,
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);

    const response = await fetch(`${await app.getUrl()}/api/public/qa`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "联系 13800001111 或 alice@example.com" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      answer: "Public mock answer for: 联系 138****1111 或 a***@example.com",
      sources: [],
    });
  });
});
