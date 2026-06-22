import { Module } from "@nestjs/common";

import { ClientsModule } from "../clients";
import { DemoQaController } from "./demo-qa.controller";
import { DemoQaService } from "./demo-qa.service";

@Module({
  imports: [ClientsModule],
  controllers: [DemoQaController],
  providers: [DemoQaService],
})
export class DemoModule {}
