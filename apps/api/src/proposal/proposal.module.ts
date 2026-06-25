import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ClientsModule } from "../clients";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { QaModule } from "../qa/qa.module";
import { ProposalExportController } from "./export/proposal-export.controller";
import { ProposalExportService } from "./export/proposal-export.service";
import { ProposalCrudController } from "./proposal-crud.controller";
import { ProposalCrudService } from "./proposal-crud.service";
import { ProposalOwnerService } from "./proposal-owner.service";
import { ProposalController } from "./proposal.controller";
import { ProposalService } from "./proposal.service";
import { PROPOSAL_PROMPT, proposalRequirementPrompt } from "./proposal.prompt";
import { ProposalTemplateController } from "./proposal-template.controller";
import {
  PROPOSAL_TEMPLATE_DIRECTORY,
  resolveProposalTemplateDirectory,
  TemplateService,
} from "./proposal-template.service";

@Module({
  imports: [AuditModule, AuthModule, ClientsModule, QaModule],
  controllers: [
    ProposalController,
    ProposalCrudController,
    ProposalExportController,
    ProposalTemplateController,
  ],
  providers: [
    InternalOnlyGuard,
    ProposalCrudService,
    ProposalExportService,
    ProposalOwnerService,
    ProposalService,
    TemplateService,
    {
      provide: PROPOSAL_PROMPT,
      useValue: proposalRequirementPrompt,
    },
    {
      provide: PROPOSAL_TEMPLATE_DIRECTORY,
      useFactory: resolveProposalTemplateDirectory,
    },
  ],
  exports: [ProposalOwnerService, ProposalService, TemplateService],
})
export class ProposalModule {}
