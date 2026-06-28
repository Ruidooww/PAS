import { Module } from "@nestjs/common";

import { ClientsModule } from "../../clients/clients.module";
import { KbSyncScheduler } from "./kb-sync.scheduler";
import { KbSyncService } from "./kb-sync.service";

@Module({
  imports: [ClientsModule],
  providers: [KbSyncScheduler, KbSyncService],
  exports: [KbSyncService],
})
export class KbSyncModule {}
