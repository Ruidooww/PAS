import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { KgController } from "./kg.controller";
import { KgService } from "./kg.service";

@Module({
  imports: [AuditModule],
  controllers: [KgController],
  providers: [InternalOnlyGuard, KgService],
  exports: [KgService],
})
export class KgModule {}
