import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";

import { ProposalOwnerService } from "../proposal-owner.service";
import { parseExportContent } from "./proposal-export-content";
import { renderProposalDocx } from "./proposal-export-docx";
import {
  buildProposalFilename,
  contentDispositionAttachment,
} from "./proposal-export-filename";
import { renderProposalMarkdown } from "./proposal-export-markdown";

export type ProposalExportFormat = "md" | "docx";

export interface ProposalExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  contentDisposition: string;
}

const FORMAT_CONTENT_TYPES: Record<ProposalExportFormat, string> = {
  md: "text/markdown; charset=utf-8",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

@Injectable()
export class ProposalExportService {
  constructor(
    @Inject(ProposalOwnerService) private readonly owner: ProposalOwnerService,
  ) {}

  async export(
    proposalId: string,
    userId: string,
    format: ProposalExportFormat,
  ): Promise<ProposalExportResult> {
    const proposal = await this.owner.findOwnedProposal(proposalId, userId);
    if (!proposal.contentJson) {
      throw new BadRequestException(
        "Proposal content is not available; generate sections before exporting",
      );
    }
    const content = parseExportContent(proposal.contentJson);
    if (!content) {
      throw new UnprocessableEntityException(
        "Proposal content is not in an exportable shape",
      );
    }
    const filename = buildProposalFilename({
      customerRef: proposal.customerRef,
      title: proposal.title,
      version: proposal.version,
      extension: format,
    });
    const contentDisposition = contentDispositionAttachment(filename);
    const contentType = FORMAT_CONTENT_TYPES[format];

    if (format === "md") {
      const markdown = renderProposalMarkdown({
        title: proposal.title,
        customerRef: proposal.customerRef,
        version: proposal.version,
        content,
      });
      return {
        buffer: Buffer.from(markdown, "utf8"),
        filename,
        contentType,
        contentDisposition,
      };
    }

    const buffer = await renderProposalDocx({
      title: proposal.title,
      customerRef: proposal.customerRef,
      version: proposal.version,
      content,
    });
    return { buffer, filename, contentType, contentDisposition };
  }
}
