import { Controller, Get } from "@nestjs/common";

@Controller("api")
export class AppController {
  @Get("health")
  health(): { service: string; status: string } {
    return { service: "pas-api", status: "ok" };
  }
}
