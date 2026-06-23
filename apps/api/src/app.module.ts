import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { validateEnv } from "./config/env.schema";
import { InternalModule } from "./internal/internal.module";
import { PublicModule } from "./public/public.module";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnv,
    }),
    AuthModule,
    InternalModule,
    PublicModule,
    SharedModule,
  ],
})
export class AppModule {}
