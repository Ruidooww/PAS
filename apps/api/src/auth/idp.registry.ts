import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FeishuIdpClient,
  type IdpClient,
  type IdpProvider,
  MockIdpClient,
  WecomIdpClient,
} from "@pas/clients";

export const IDP_PROVIDERS: IdpProvider[] = ["feishu", "mock", "wecom"];

export function parseIdpProvider(value: unknown): IdpProvider {
  if (value === "feishu" || value === "mock" || value === "wecom") return value;
  throw new BadRequestException("provider must be feishu, wecom, or mock");
}

@Injectable()
export class IdpRegistry {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  getClient(provider: IdpProvider): IdpClient {
    const mode = this.config.getOrThrow<string>("IDP_MODE");
    if (mode === "mock" && provider !== "mock") {
      throw new BadRequestException("Only provider=mock is enabled when IDP_MODE=mock");
    }
    if (mode === "real" && provider === "mock") {
      throw new BadRequestException("provider=mock is disabled when IDP_MODE=real");
    }
    switch (provider) {
      case "mock":
        return new MockIdpClient();
      case "feishu":
        return new FeishuIdpClient({
          appId: this.config.getOrThrow<string>("FEISHU_APP_ID"),
          appSecret: this.config.getOrThrow<string>("FEISHU_APP_SECRET"),
        });
      case "wecom":
        return new WecomIdpClient({
          corpId: this.config.getOrThrow<string>("WECOM_CORP_ID"),
          agentId: this.config.getOrThrow<string>("WECOM_AGENT_ID"),
          appSecret: this.config.getOrThrow<string>("WECOM_APP_SECRET"),
        });
    }
  }

  getRedirectUri(provider: IdpProvider, origin: string): string {
    if (provider === "mock") return `${origin}/auth/callback?provider=mock`;
    if (provider === "feishu") return this.config.getOrThrow<string>("FEISHU_REDIRECT_URI");
    return this.config.getOrThrow<string>("WECOM_REDIRECT_URI");
  }
}