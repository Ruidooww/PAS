import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { KbDocumentsController } from "./kb-documents.controller";

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [KbDocumentsController],
  providers: [InternalOnlyGuard],
})
export class KbDocumentsModule {}
