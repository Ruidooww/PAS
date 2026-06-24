import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AuditInterceptor } from "./audit/audit.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { validateEnv } from "./config/env.schema";
import { InternalModule } from "./internal/internal.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicModule } from "./public/public.module";
import { SanitizeInterceptor } from "./sanitize/sanitize.interceptor";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    InternalModule,
    PublicModule,
    SharedModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SanitizeInterceptor },
  ],
})
export class AppModule {}
