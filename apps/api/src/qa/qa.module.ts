import { Module } from "@nestjs/common";

import { ClientsModule } from "../clients";
import { QA_PROMPT, readQaPrompt } from "./qa.prompt";
import { QaService } from "./qa.service";

@Module({
  imports: [ClientsModule],
  providers: [QaService, { provide: QA_PROMPT, useFactory: readQaPrompt }],
  exports: [QaService],
})
export class QaModule {}
