import { describe, expect, it } from "vitest";

import { linkAnswerCitations } from "./citation-links";

describe("linkAnswerCitations", () => {
  it("links known prose citations and leaves unknown references alone", () => {
    expect(linkAnswerCitations("使用策略中心 [1]，另见 [3]。", [1])).toBe(
      "使用策略中心 [1](#qa-source-1)，另见 [3]。",
    );
  });

  it("does not rewrite fenced code, inline code, or existing markdown links", () => {
    const markdown = [
      "正文 [1]",
      "",
      "```ts",
      'const ref = "[1]";',
      "```",
      "",
      "inline `[1]` and [existing](https://example.com/[1])",
    ].join("\n");

    expect(linkAnswerCitations(markdown, [1])).toBe(
      [
        "正文 [1](#qa-source-1)",
        "",
        "```ts",
        'const ref = "[1]";',
        "```",
        "",
        "inline `[1]` and [existing](https://example.com/[1])",
      ].join("\n"),
    );
  });

  it("keeps citation-like identifiers and images untouched", () => {
    expect(linkAnswerCitations("[ID:1] ![1](https://example.com/a.png)", [1])).toBe(
      "[ID:1] ![1](https://example.com/a.png)",
    );
  });
});
