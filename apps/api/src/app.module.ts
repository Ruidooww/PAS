import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { validateEnv } from "./config/env.schema";
import { DemoModule } from "./demo/demo.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnv,
    }),
    DemoModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
