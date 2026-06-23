import { Module } from "@nestjs/common";

import { AuthModule } from "../../auth/auth.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { InternalAdminController } from "./internal-admin.controller";

@Module({
  imports: [AuthModule],
  controllers: [InternalAdminController],
  providers: [InternalOnlyGuard],
})
export class InternalAdminModule {}
