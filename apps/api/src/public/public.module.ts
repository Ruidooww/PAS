import { Module } from "@nestjs/common";

import { PublicClientsModule } from "./public-clients.module";
import { PublicQaController } from "./qa/public-qa.controller";
import { PublicQaService } from "./qa/public-qa.service";

@Module({
  imports: [PublicClientsModule],
  controllers: [PublicQaController],
  providers: [PublicQaService],
})
export class PublicModule {}
