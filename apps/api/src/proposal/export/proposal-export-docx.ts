import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { ExportContent, ExportReference } from "./proposal-export-content";

export interface DocxInput {
  title: string;
  customerRef: string;
  version: number;
  content: ExportContent;
}

export async function renderProposalDocx(input: DocxInput): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: input.title, bold: true })],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `客户：${input.customerRef} ｜ 版本：v${input.version}`,
          italics: true,
        }),
      ],
    }),
  );

  for (const section of input.content.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: section.title })],
      }),
    );
    for (const paragraph of bodyParagraphs(section.body)) {
      children.push(paragraph);
    }
    if (section.refs.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "引用" })],
        }),
      );
      for (const ref of sortRefs(section.refs)) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: formatReference(ref), italics: true })],
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

function bodyParagraphs(body: string): Paragraph[] {
  const trimmed = body.trim();
  if (trimmed.length === 0) return [];
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line })],
        }),
    );
}

function sortRefs(refs: ExportReference[]): ExportReference[] {
  return [...refs].sort((left, right) => left.n - right.n);
}

function formatReference(ref: ExportReference): string {
  const docName = ref.docName.length > 0 ? ref.docName : "未命名来源";
  return ref.page === undefined
    ? `[${ref.n}] ${docName}`
    : `[${ref.n}] ${docName}, page ${ref.page}`;
}
