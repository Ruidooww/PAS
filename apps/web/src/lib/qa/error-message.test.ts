import { describe, expect, it } from "vitest";

import { QaHttpError } from "./sse-client";
import { qaErrorMessage } from "./error-message";

describe("qaErrorMessage", () => {
  it("maps authorization and broken-stream failures to actionable messages", () => {
    expect(qaErrorMessage(new QaHttpError(403, "Forbidden"))).toContain("权限");
    expect(qaErrorMessage(new Error("QA stream ended before done event"))).toContain("连接已中断");
  });

  it("does not expose arbitrary backend error text", () => {
    expect(qaErrorMessage(new Error("database password leaked"))).toBe(
      "问答请求失败，请稍后重试。",
    );
  });
});
