import { Global, Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module";
import { AuthModule } from "../../auth/auth.module";
import { InternalOnlyGuard } from "../internal-only.guard";
import { AclAuditController } from "./acl-audit.controller";
import { AclAuditService } from "./acl-audit.service";
import { FieldAclService } from "./field-acl.service";

@Global()
@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AclAuditController],
  providers: [AclAuditService, FieldAclService, InternalOnlyGuard],
  exports: [AclAuditService, FieldAclService],
})
export class AclModule {}
