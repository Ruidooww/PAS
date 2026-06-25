import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ClientsModule } from "../clients";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { ProposalModule } from "../proposal/proposal.module";
import { QaModule } from "../qa/qa.module";
import { ProposalGenerationQueue } from "./proposal-generation.queue";
import { ProposalGenerationService } from "./proposal-generation.service";
import { ProposalProgressService } from "./proposal-progress.service";
import {
  PROPOSAL_SECTION_PROMPT,
  proposalSectionPrompt,
} from "./proposal-section.prompt";
import { ProposalWorkerController } from "./proposal-worker.controller";
import { ProposalWorkerRuntime } from "./proposal-worker.runtime";

@Module({
  imports: [AuditModule, AuthModule, ClientsModule, ProposalModule, QaModule],
  controllers: [ProposalWorkerController],
  providers: [
    InternalOnlyGuard,
    ProposalGenerationQueue,
    ProposalGenerationService,
    ProposalProgressService,
    ProposalWorkerRuntime,
    {
      provide: PROPOSAL_SECTION_PROMPT,
      useValue: proposalSectionPrompt,
    },
  ],
  exports: [
    ProposalGenerationQueue,
    ProposalGenerationService,
    ProposalProgressService,
  ],
})
export class ProposalWorkerModule {}
