import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { AuthModule } from "../../auth/auth.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { FeedbackDashboardService } from "./feedback-dashboard.service";
import { InternalAdminController } from "./internal-admin.controller";

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [InternalAdminController],
  providers: [InternalOnlyGuard, FeedbackDashboardService],
})
export class InternalAdminModule {}
