import { Controller, Get, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../../auth/auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { InternalOnlyGuard } from "../internal-only.guard";

@Controller("api/internal/admin")
@UseGuards(AuthGuard, InternalOnlyGuard, RolesGuard)
@Roles("admin")
export class InternalAdminController {
  @Get("ping")
  ping(): { ok: true } {
    return { ok: true };
  }
}
