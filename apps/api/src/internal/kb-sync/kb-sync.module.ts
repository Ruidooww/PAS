import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { AuthModule } from "../../auth/auth.module";
import { ClientsModule } from "../../clients/clients.module";
import { KgSyncModule } from "../kg-sync/kg-sync.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { KbSyncController } from "./kb-sync.controller";
import { KbSyncScheduler } from "./kb-sync.scheduler";
import { KbSyncService } from "./kb-sync.service";

@Module({
  imports: [AuditModule, AuthModule, ClientsModule, KgSyncModule],
  controllers: [KbSyncController],
  providers: [InternalOnlyGuard, KbSyncScheduler, KbSyncService],
  exports: [KbSyncService],
})
export class KbSyncModule {}
