// Agent client — Stub only for MVP.
// 见 ADR-001 § 决策修订记录 (2026-06-23)：FastGPT workflow MVP 不调用，
// agentClient 留接口 + Mock，v2 智能客服 Agent 启动时再实现真实 FastGPT OpenAPI 客户端。

import { Injectable, Logger } from "@nestjs/common";
import type { JsonObject, JsonValue } from "@pas/shared";

export const AGENT_CLIENT = Symbol("AGENT_CLIENT");

/**
 * `identity` 必填——为 v2 真实启用 FastGPT 时的契约打基础。
 * 即便 MVP 不真调，业务层也要按这个契约传，否则启用真实 client 时会留漏洞。
 */
export interface AgentIdentity {
  pasUserId: string;
  tenantId: string;
  customerId?: string;
}

export interface AgentRunResult {
  workflowId: string;
  output: JsonValue;
  /** 标记 mock 输出，避免被下游误当真 FastGPT 响应。 */
  isMock: true;
}

export interface AgentClient {
  runWorkflow(params: {
    workflowId: string;
    inputs: JsonObject;
    identity: AgentIdentity;
  }): Promise<AgentRunResult>;
}

@Injectable()
export class AgentClientMock implements AgentClient {
  private readonly logger = new Logger(AgentClientMock.name);
  private warned = false;

  async runWorkflow(params: {
    workflowId: string;
    inputs: JsonObject;
    identity: AgentIdentity;
  }): Promise<AgentRunResult> {
    if (!params.identity || !params.identity.pasUserId || !params.identity.tenantId) {
      throw new Error(
        "AgentClient.runWorkflow requires identity { pasUserId, tenantId } — " +
          "契约 (ADR-001 § 反向 3) 即便 mock 也要保证调用方传入。",
      );
    }
    if (!this.warned) {
      this.logger.warn(
        "AgentClientMock invoked. MVP 不调用真实 FastGPT (ADR-001 § 决策修订记录)。" +
          "v2 智能客服 Agent 启动时再实现 AgentClientImpl。",
      );
      this.warned = true;
    }
    return {
      workflowId: params.workflowId,
      output: {
        mock: true,
        echoedInputKeys: Object.keys(params.inputs),
        identity: {
          pasUserId: params.identity.pasUserId,
          tenantId: params.identity.tenantId,
          customerId: params.identity.customerId ?? null,
        },
      },
      isMock: true,
    };
  }
}
