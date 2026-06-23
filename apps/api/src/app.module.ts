import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { validateEnv } from "./config/env.schema";
import { DemoModule } from "./demo/demo.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnv,
    }),
    AuthModule,
    DemoModule,
  ],
  controllers: [AppController],
})
export class AppModule {}