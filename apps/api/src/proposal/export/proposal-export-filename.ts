export interface ProposalFilenameInput {
  customerRef: string;
  title: string;
  version: number;
  extension: "md" | "docx";
}

export function buildProposalFilename(input: ProposalFilenameInput): string {
  const customer = sanitize(input.customerRef);
  const title = sanitize(input.title);
  const segments = [customer, title].filter((part) => part.length > 0);
  const stem = segments.length > 0 ? segments.join("-") : "proposal";
  return `${stem}-v${input.version}.${input.extension}`;
}

export function contentDispositionAttachment(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename*=UTF-8''${encoded}`;
}

function sanitize(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
