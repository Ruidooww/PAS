import { Module } from "@nestjs/common";

import { ClientsModule } from "../../clients/clients.module";
import { KgSyncModule } from "../kg-sync/kg-sync.module";
import { KbSyncScheduler } from "./kb-sync.scheduler";
import { KbSyncService } from "./kb-sync.service";

@Module({
  imports: [ClientsModule, KgSyncModule],
  providers: [KbSyncScheduler, KbSyncService],
  exports: [KbSyncService],
})
export class KbSyncModule {}
