import { Module } from "@nestjs/common";

import { ClientsModule } from "../clients";
import { AclService } from "../internal/acl.service";
import { QA_PROMPT, readQaPrompt } from "./qa.prompt";
import { QaService } from "./qa.service";

@Module({
  imports: [ClientsModule],
  providers: [AclService, QaService, { provide: QA_PROMPT, useFactory: readQaPrompt }],
  exports: [AclService, QaService],
})
export class QaModule {}
