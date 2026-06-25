import type { ExportContent, ExportReference } from "./proposal-export-content";

export interface MarkdownInput {
  title: string;
  customerRef: string;
  version: number;
  content: ExportContent;
}

export function renderProposalMarkdown(input: MarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(`> 客户：${input.customerRef} ｜ 版本：v${input.version}`);
  lines.push("");

  for (const section of input.content.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    const body = section.body.trim();
    if (body.length > 0) {
      lines.push(body);
      lines.push("");
    }
    if (section.refs.length > 0) {
      lines.push("**引用**");
      lines.push("");
      for (const ref of sortRefs(section.refs)) {
        lines.push(formatReference(ref));
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
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
