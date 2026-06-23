import { Controller, Get, type CallHandler, type ExecutionContext, UseGuards } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { lastValueFrom, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../src/auth/auth.guard";
import { AuthModule } from "../src/auth/auth.module";
import { JwtSessionService } from "../src/auth/jwt-session.service";
import { SESSION_COOKIE_NAME, type SessionClaims } from "../src/auth/types";
import { validateEnv } from "../src/config/env.schema";
import { PrismaService } from "../src/prisma/prisma.service";
import { SanitizeInterceptor } from "../src/sanitize/sanitize.interceptor";
import { Sensitive } from "../src/sanitize/sensitive.decorator";

const completeEnv = {
  APP_BASE_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://pas:pas@localhost:5544/pas",
  CRM_API_KEY: "test-crm-key",
  CRM_BASE_URL: "https://crm.example.com/api",
  CRM_PROVIDER: "external",
  FEISHU_APP_ID: "cli_test",
  FEISHU_APP_SECRET: "test-feishu-secret",
  FEISHU_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=feishu",
  IDP_MODE: "mock",
  JWT_SECRET: "test-secret-at-least-32-characters-long",
  LLM_API_KEY: "test-llm-key",
  LLM_BASE_URL: "https://llm.example.com/v1",
  LLM_CLIENT_MODE: "mock",
  LLM_MODEL: "test-model",
  MINIO_ACCESS_KEY: "pas",
  MINIO_BUCKET: "pas-dev",
  MINIO_ENDPOINT: "http://localhost:9900",
  MINIO_SECRET_KEY: "test-minio-secret",
  NODE_ENV: "test",
  RAGFLOW_API_KEY: "test-ragflow-key",
  RAGFLOW_BASE_URL: "http://localhost:9380",
  RAGFLOW_CLIENT_MODE: "mock",
  REDIS_URL: "redis://localhost:6399",
  WECOM_AGENT_ID: "1000002",
  WECOM_APP_SECRET: "test-wecom-secret",
  WECOM_CORP_ID: "ww_test",
  WECOM_REDIRECT_URI: "http://localhost:3001/auth/callback?provider=wecom",
};

class SensitiveContactDto {
  @Sensitive({ maskFor: ["external"] })
  phone = "13812345678";

  @Sensitive({ maskFor: ["external"] })
  email = "alice@example.com";

  @Sensitive({ maskFor: ["external"] })
  contractAmount = 128_000;

  publicNote = "visible";
}

function session(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    uid: "user-1",
    tenantId: "tenant-default",
    idpProvider: "mock",
    idpUserId: "mock-user-1",
    name: "Mock User",
    email: "mock.presales@example.com",
    role: "presales",
    isExternal: false,
    deptId: "dept-presales",
    ...overrides,
  };
}

function contextFor(user: SessionClaims): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

function handlerFor(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe("SanitizeInterceptor", () => {
  it("masks fields marked with @Sensitive for external users before serialization", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SanitizeInterceptor],
    }).compile();
    const interceptor = moduleRef.get(SanitizeInterceptor);

    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(session({ role: "external", isExternal: true })),
        handlerFor(new SensitiveContactDto()),
      ),
    );

    expect(result).toEqual({
      phone: "138****5678",
      email: "a***@example.com",
      publicNote: "visible",
    });
    expect(result).not.toHaveProperty("contractAmount");
  });

  it("leaves sensitive fields unchanged for internal users", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SanitizeInterceptor],
    }).compile();
    const interceptor = moduleRef.get(SanitizeInterceptor);

    const result = await lastValueFrom(
      interceptor.intercept(contextFor(session()), handlerFor(new SensitiveContactDto())),
    );

    expect(result).toMatchObject({
      phone: "13812345678",
      email: "alice@example.com",
      contractAmount: 128_000,
      publicNote: "visible",
    });
  });
});

describe("SanitizeInterceptor e2e", () => {
  @Controller("api/test-sensitive")
  class SensitiveTestController {
    @Get("contact")
    @UseGuards(AuthGuard)
    contact(): SensitiveContactDto {
      return new SensitiveContactDto();
    }
  }

  let app: import("@nestjs/common").INestApplication;
  let baseUrl: string;
  let jwt: JwtSessionService;

  beforeEach(async () => {
    for (const [key, value] of Object.entries(completeEnv)) {
      vi.stubEnv(key, value);
    }
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          validate: validateEnv,
        }),
        AuthModule,
      ],
      controllers: [SensitiveTestController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: SanitizeInterceptor }],
    })
      .overrideProvider(PrismaService)
      .useValue({ onModuleInit: async () => undefined, onModuleDestroy: async () => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    jwt = new JwtSessionService(completeEnv.JWT_SECRET, 604_800);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it("masks a phone-bearing GET response for external users but not internal users", async () => {
    const externalToken = jwt.sign(session({ uid: "external-1", role: "external", isExternal: true }));
    const internalToken = jwt.sign(session({ uid: "admin-1", role: "admin", isExternal: false }));

    const external = await fetch(`${baseUrl}/api/test-sensitive/contact`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${externalToken}` },
    });
    const internal = await fetch(`${baseUrl}/api/test-sensitive/contact`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${internalToken}` },
    });

    expect(external.status).toBe(200);
    expect(internal.status).toBe(200);
    await expect(external.json()).resolves.toEqual({
      phone: "138****5678",
      email: "a***@example.com",
      publicNote: "visible",
    });
    await expect(internal.json()).resolves.toMatchObject({
      phone: "13812345678",
      email: "alice@example.com",
      contractAmount: 128_000,
      publicNote: "visible",
    });
  });
});
