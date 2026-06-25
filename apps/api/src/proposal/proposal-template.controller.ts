import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { InternalOnlyGuard } from "../internal/internal-only.guard";
import { TemplateService } from "./proposal-template.service";

@Controller("api/internal/proposal-templates")
@UseGuards(AuthGuard, InternalOnlyGuard)
export class ProposalTemplateController {
  constructor(@Inject(TemplateService) private readonly templates: TemplateService) {}

  @Get()
  listTemplates() {
    return this.templates.listTemplates();
  }
}
