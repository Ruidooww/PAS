import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import {
  customerListQuerySchema,
  opportunityListQuerySchema,
} from "./customer.schema";
import { CustomerService } from "./customer.service";

@Controller("api/internal")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class CustomerController {
  constructor(@Inject(CustomerService) private readonly customers: CustomerService) {}

  @Get("customers")
  list(@Query() query: Record<string, unknown>) {
    const parsed = customerListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid customer list query",
        issues: parsed.error.issues,
      });
    }
    return this.customers.list(parsed.data);
  }

  @Get("customers/:ref")
  detail(@Param("ref") ref: string, @Req() request: AuthenticatedRequest) {
    return this.customers.detail(ref, request.user!);
  }

  @Get("opportunities")
  listOpportunities(@Query() query: Record<string, unknown>) {
    const parsed = opportunityListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid opportunity list query",
        issues: parsed.error.issues,
      });
    }
    return this.customers.listOpportunities(parsed.data);
  }

  @Get("opportunities/:ref")
  getOpportunity(@Param("ref") ref: string) {
    return this.customers.getOpportunity(ref);
  }
}
