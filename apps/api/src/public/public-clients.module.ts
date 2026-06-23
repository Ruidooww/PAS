import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { RagflowClientImpl, RagflowClientMock } from "../clients/ragflow";

export const PUBLIC_RAGFLOW_CLIENT = Symbol("PUBLIC_RAGFLOW_CLIENT");

@Module({
  providers: [
    {
      provide: PUBLIC_RAGFLOW_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>("RAGFLOW_CLIENT_MODE") === "mock"
          ? new RagflowClientMock()
          : new RagflowClientImpl(config),
    },
  ],
  exports: [PUBLIC_RAGFLOW_CLIENT],
})
export class PublicClientsModule {}
