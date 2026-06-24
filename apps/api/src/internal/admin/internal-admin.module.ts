import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { AuthModule } from "../../auth/auth.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { InternalAdminController } from "./internal-admin.controller";

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [InternalAdminController],
  providers: [InternalOnlyGuard],
})
export class InternalAdminModule {}
