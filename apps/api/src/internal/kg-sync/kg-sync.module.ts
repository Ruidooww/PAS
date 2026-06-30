import { Module } from "@nestjs/common";

import { ClientsModule } from "../../clients";
import { KG_EXTRACT_PROMPT, kgExtractPrompt } from "./kg-extract.prompt";
import { KgExtractQueue } from "./kg-extract.queue";
import { KgExtractService } from "./kg-extract.service";
import { KgExtractWorker } from "./kg-extract.worker";

@Module({
  imports: [ClientsModule],
  providers: [
    KgExtractQueue,
    KgExtractService,
    KgExtractWorker,
    {
      provide: KG_EXTRACT_PROMPT,
      useValue: kgExtractPrompt,
    },
  ],
  exports: [KgExtractQueue, KgExtractService],
})
export class KgSyncModule {}
