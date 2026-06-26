import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ClientsModule } from "../clients";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { QaModule } from "../qa/qa.module";
import { CustomerCacheService } from "./customer-cache.service";
import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";

@Module({
  imports: [AuditModule, AuthModule, ClientsModule, QaModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerCacheService, InternalOnlyGuard],
  exports: [CustomerService],
})
export class CustomerModule {}
