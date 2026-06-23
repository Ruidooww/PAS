import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { IdpProvider } from "@pas/clients";

import { IdpRegistry } from "./idp.registry";
import { JwtSessionService } from "./jwt-session.service";
import { AUTH_USER_STORE, type AuthUser, type AuthUserStore } from "./user-store";

export interface LoginResult {
  state: string;
  url: string;
}

export interface CallbackResult {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(IdpRegistry) private readonly idpRegistry: IdpRegistry,
    @Inject(JwtSessionService) private readonly jwt: JwtSessionService,
    @Inject(AUTH_USER_STORE) private readonly users: AuthUserStore,
  ) {}

  buildLoginUrl(provider: IdpProvider): LoginResult {
    const state = randomUUID();
    const client = this.idpRegistry.getClient(provider);
    return {
      state,
      url: client.getAuthUrl({
        state,
        redirectUri: this.idpRegistry.getRedirectUri(provider),
      }),
    };
  }

  async completeCallback(
    provider: IdpProvider,
    code: string,
    expectedState: string | undefined,
    receivedState: string | undefined,
  ): Promise<CallbackResult> {
    if (!expectedState || !receivedState || expectedState !== receivedState) {
      throw new BadRequestException("Invalid OAuth state");
    }

    const client = this.idpRegistry.getClient(provider);
    const token = await client.exchangeCode({ code });
    const profile = await client.getUserInfo({ accessToken: token.accessToken });
    const user = await this.users.upsertFromProfile(provider, profile);
    return { token: this.jwt.sign(user), user };
  }
}
