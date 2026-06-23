import { BadRequestException, Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../../auth/auth.guard";
import type { AuthenticatedRequest } from "../../auth/types";
import { InternalOnlyGuard } from "../internal-only.guard";
import { InternalQaService, type InternalQaAnswer } from "./internal-qa.service";

@Controller("api/internal/qa")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class InternalQaController {
  constructor(@Inject(InternalQaService) private readonly qa: InternalQaService) {}

  @Post()
  ask(
    @Body() body: { query?: unknown },
    @Req() req: AuthenticatedRequest,
  ): Promise<InternalQaAnswer> {
    if (typeof body.query !== "string" || body.query.trim().length === 0) {
      throw new BadRequestException("query must be a non-empty string");
    }
    return this.qa.ask(body.query.trim(), req.user!);
  }
}


