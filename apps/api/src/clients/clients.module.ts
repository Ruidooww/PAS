import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AGENT_CLIENT, AgentClientMock } from "./agent";
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
    {
      // MVP 永远走 Mock — ADR-001 § 决策修订记录 (2026-06-23)。
      // v2 启用时再加 AgentClientImpl + AGENT_CLIENT_MODE 切换逻辑。
      provide: AGENT_CLIENT,
      useFactory: () => new AgentClientMock(),
    },
  ],
  exports: [AGENT_CLIENT, CRM_CLIENT, LLM_CLIENT, RAGFLOW_CLIENT],
})
export class ClientsModule {}
