import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ClientsModule } from "../clients";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
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
  imports: [AuditModule, AuthModule, ClientsModule],
  controllers: [ProposalController, ProposalTemplateController],
  providers: [
    InternalOnlyGuard,
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
  exports: [ProposalService, TemplateService],
})
export class ProposalModule {}
