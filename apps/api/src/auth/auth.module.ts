import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../prisma/prisma.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { IdpRegistry } from "./idp.registry";
import { JwtAuthMiddleware } from "./jwt-auth.middleware";
import { JwtSessionService } from "./jwt-session.service";
import { RolesGuard } from "./roles.guard";
import { DEFAULT_SESSION_TTL_SECONDS } from "./types";
import { AUTH_USER_STORE, PrismaAuthUserStore } from "./user-store";

@Module({
  controllers: [AuthController],
  providers: [
    AuthGuard,
    AuthService,
    IdpRegistry,
    JwtAuthMiddleware,
    RolesGuard,
    PrismaService,
    {
      provide: JwtSessionService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtSessionService(
          config.getOrThrow<string>("JWT_SECRET"),
          config.get<number>("JWT_SESSION_TTL_SECONDS") ?? DEFAULT_SESSION_TTL_SECONDS,
        ),
    },
    {
      provide: AUTH_USER_STORE,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAuthUserStore(prisma),
    },
  ],
  exports: [AUTH_USER_STORE, AuthGuard, AuthService, JwtSessionService, RolesGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JwtAuthMiddleware).forRoutes("*");
  }
}
