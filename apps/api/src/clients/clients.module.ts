import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CRM_CLIENT, ExternalCrmClient, PasCrmClient } from "./crm";
import { LLM_CLIENT, LlmClientImpl, LlmClientMock } from "./llm";
import { RAGFLOW_CLIENT, RagflowClientImpl, RagflowClientMock } from "./ragflow";

@Module({
  providers: [
    {
      provide: RAGFLOW_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>("RAGFLOW_CLIENT_MODE") === "mock"
          ? new RagflowClientMock()
          : new RagflowClientImpl(config),
    },
    {
      provide: LLM_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>("LLM_CLIENT_MODE") === "mock"
          ? new LlmClientMock()
          : new LlmClientImpl(config),
    },
    {
      provide: CRM_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>("CRM_PROVIDER") === "pas"
          ? new PasCrmClient()
          : new ExternalCrmClient(config),
    },
  ],
  exports: [CRM_CLIENT, LLM_CLIENT, RAGFLOW_CLIENT],
})
export class ClientsModule {}
