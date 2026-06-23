import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";

import { PublicQaService, type PublicQaAnswer } from "./public-qa.service";

@Controller("api/public/qa")
export class PublicQaController {
  constructor(@Inject(PublicQaService) private readonly qa: PublicQaService) {}

  @Post()
  ask(@Body() body: { query?: unknown }): Promise<PublicQaAnswer> {
    if (typeof body.query !== "string" || body.query.trim().length === 0) {
      throw new BadRequestException("query must be a non-empty string");
    }
    return this.qa.ask(body.query.trim());
  }
}

