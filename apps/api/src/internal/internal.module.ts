import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ProposalModule } from "../proposal/proposal.module";
import { ProposalWorkerModule } from "../proposal-worker/proposal-worker.module";
import { InternalAdminModule } from "./admin/internal-admin.module";
import { KbDocumentsModule } from "./kb-documents/kb-documents.module";
import { KgModule } from "./kg/kg.module";
import { InternalQaModule } from "./qa/internal-qa.module";

@Module({
  imports: [
    AuthModule,
    InternalQaModule,
    KbDocumentsModule,
    KgModule,
    InternalAdminModule,
    ProposalModule,
    ProposalWorkerModule,
  ],
})
export class InternalModule {}

