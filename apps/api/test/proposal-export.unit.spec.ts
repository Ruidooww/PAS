import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { parseExportContent } from "../src/proposal/export/proposal-export-content";
import { renderProposalDocx } from "../src/proposal/export/proposal-export-docx";
import {
  buildProposalFilename,
  contentDispositionAttachment,
} from "../src/proposal/export/proposal-export-filename";
import { renderProposalMarkdown } from "../src/proposal/export/proposal-export-markdown";

const sampleContent = {
  sections: [
    {
      id: "background",
      title: "项目背景",
      body: "客户面临数据外泄风险，需建设端点 DLP。\n第二段说明范围。",
      refs: [],
    },
    {
      id: "solution",
      title: "解决方案",
      body: "推荐 IP-Guard 标准版 [1]，结合视觉感知模块 [2]。",
      refs: [
        { n: 1, chunkId: "c-1", docName: "IP-Guard 白皮书.pdf", page: 24 },
        { n: 2, chunkId: "c-2", docName: "视觉感知说明.pdf" },
      ],
    },
  ],
};

describe("parseExportContent", () => {
  it("returns null for null content", () => {
    expect(parseExportContent(null)).toBeNull();
  });

  it("returns null when sections is not an array", () => {
    expect(parseExportContent({ sections: {} })).toBeNull();
  });

  it("ignores refs with missing n", () => {
    const parsed = parseExportContent({
      sections: [
        {
          title: "t",
          body: "b",
          refs: [{ docName: "x.pdf" }, { n: 2, docName: "y.pdf", page: 5 }],
        },
      ],
    });
    expect(parsed?.sections[0]?.refs).toEqual([
      { n: 2, docName: "y.pdf", page: 5 },
    ]);
  });
});

describe("buildProposalFilename", () => {
  it("joins customer, title, version with extension", () => {
    expect(
      buildProposalFilename({
        customerRef: "Acme",
        title: "DLP 方案",
        version: 3,
        extension: "docx",
      }),
    ).toBe("Acme-DLP 方案-v3.docx");
  });

  it("strips path-unsafe characters", () => {
    expect(
      buildProposalFilename({
        customerRef: "Acme/Subsidiary",
        title: "v1: pilot?",
        version: 1,
        extension: "md",
      }),
    ).toBe("Acme Subsidiary-v1 pilot-v1.md");
  });

  it("falls back to proposal when all parts are empty", () => {
    expect(
      buildProposalFilename({
        customerRef: " ",
        title: "",
        version: 1,
        extension: "md",
      }),
    ).toBe("proposal-v1.md");
  });
});

describe("contentDispositionAttachment", () => {
  it("encodes Chinese characters with RFC 5987", () => {
    const header = contentDispositionAttachment("华义匀安-方案-v1.docx");
    expect(header).toMatch(/^attachment; filename\*=UTF-8''/);
    expect(header).toContain(encodeURIComponent("华义匀安-方案-v1.docx"));
  });
});

describe("renderProposalMarkdown", () => {
  it("renders title, customer line, chapters, and references", () => {
    const md = renderProposalMarkdown({
      title: "Acme DLP 方案",
      customerRef: "Acme",
      version: 2,
      content: parseExportContent(sampleContent)!,
    });
    expect(md).toContain("# Acme DLP 方案");
    expect(md).toContain("> 客户：Acme ｜ 版本：v2");
    expect(md).toContain("## 项目背景");
    expect(md).toContain("第二段说明范围。");
    expect(md).toContain("## 解决方案");
    expect(md).toContain("[1] IP-Guard 白皮书.pdf, page 24");
    expect(md).toContain("[2] 视觉感知说明.pdf");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("omits the references block when a section has no refs", () => {
    const md = renderProposalMarkdown({
      title: "t",
      customerRef: "c",
      version: 1,
      content: { sections: [{ title: "x", body: "y", refs: [] }] },
    });
    expect(md).not.toContain("**引用**");
  });
});

describe("renderProposalDocx", () => {
  it("packs a valid docx zip containing chapter titles and references", async () => {
    const buffer = await renderProposalDocx({
      title: "Acme DLP 方案",
      customerRef: "Acme",
      version: 2,
      content: parseExportContent(sampleContent)!,
    });
    expect(buffer.length).toBeGreaterThan(1024);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");

    const zip = await JSZip.loadAsync(buffer);
    const documentEntry = zip.file("word/document.xml");
    expect(documentEntry).not.toBeNull();
    const xml = await documentEntry!.async("string");
    expect(xml).toContain("Acme DLP 方案");
    expect(xml).toContain("项目背景");
    expect(xml).toContain("解决方案");
    expect(xml).toContain("[1] IP-Guard 白皮书.pdf, page 24");
    expect(xml).toContain("[2] 视觉感知说明.pdf");
  });
});
