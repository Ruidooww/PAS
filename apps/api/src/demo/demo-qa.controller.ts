import { BadRequestException, Body, Controller, Post } from "@nestjs/common";

import { DemoQaService, type DemoQaAnswer } from "./demo-qa.service";

@Controller("api/demo")
export class DemoQaController {
  constructor(private readonly demoQaService: DemoQaService) {}

  @Post("qa")
  ask(@Body() body: { query?: unknown }): Promise<DemoQaAnswer> {
    if (typeof body.query !== "string" || body.query.trim().length === 0) {
      throw new BadRequestException("query must be a non-empty string");
    }
    return this.demoQaService.ask(body.query.trim());
  }
}
