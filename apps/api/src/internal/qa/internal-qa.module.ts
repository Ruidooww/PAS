import { Module } from "@nestjs/common";

import { ClientsModule } from "../../clients";
import { PrismaService } from "../../prisma/prisma.service";
import { AclService } from "../acl.service";
import { InternalOnlyGuard } from "../internal-only.guard";
import { InternalQaController } from "./internal-qa.controller";
import { InternalQaService } from "./internal-qa.service";

@Module({
  imports: [ClientsModule],
  controllers: [InternalQaController],
  providers: [AclService, InternalOnlyGuard, InternalQaService, PrismaService],
})
export class InternalQaModule {}

