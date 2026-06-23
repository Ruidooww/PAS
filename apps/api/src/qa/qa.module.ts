import { Module } from "@nestjs/common";

import { ClientsModule } from "../clients";
import { PrismaService } from "../prisma/prisma.service";
import { QA_PROMPT, readQaPrompt } from "./qa.prompt";
import { QaService } from "./qa.service";

@Module({
  imports: [ClientsModule],
  providers: [PrismaService, QaService, { provide: QA_PROMPT, useFactory: readQaPrompt }],
  exports: [QaService],
})
export class QaModule {}
