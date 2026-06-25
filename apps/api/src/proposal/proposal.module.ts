import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ClientsModule } from "../clients";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { ProposalController } from "./proposal.controller";
import { ProposalService } from "./proposal.service";
import { PROPOSAL_PROMPT, proposalRequirementPrompt } from "./proposal.prompt";

@Module({
  imports: [AuditModule, AuthModule, ClientsModule],
  controllers: [ProposalController],
  providers: [
    InternalOnlyGuard,
    ProposalService,
    {
      provide: PROPOSAL_PROMPT,
      useValue: proposalRequirementPrompt,
    },
  ],
  exports: [ProposalService],
})
export class ProposalModule {}
