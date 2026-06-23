import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { ClientsModule } from "../../clients";
import { PrismaService } from "../../prisma/prisma.service";
import { QaModule } from "../../qa/qa.module";
import { AclService } from "../acl.service";
import { InternalOnlyGuard } from "../internal-only.guard";
import { InternalQaController } from "./internal-qa.controller";
import { InternalQaService } from "./internal-qa.service";

@Module({
  imports: [AuditModule, ClientsModule, QaModule],
  controllers: [InternalQaController],
  providers: [AclService, InternalOnlyGuard, InternalQaService, PrismaService],
})
export class InternalQaModule {}

