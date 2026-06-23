import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { InternalAdminModule } from "./admin/internal-admin.module";
import { InternalQaModule } from "./qa/internal-qa.module";

@Module({
  imports: [AuthModule, InternalQaModule, InternalAdminModule],
})
export class InternalModule {}

