import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChatMessage } from "@pas/shared";
import { z } from "zod";

export const LLM_CLIENT = Symbol("LLM_CLIENT");

export interface LlmClient {
  complete(params: { messages: ChatMessage[]; temperature?: number }): Promise<string>;
}

const completionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }),
    }),
  ),
});

@Injectable()
export class LlmClientImpl implements LlmClient {
  constructor(private readonly config: ConfigService) {}

  async complete(params: Parameters<LlmClient["complete"]>[0]): Promise<string> {
    const baseUrl = this.config.getOrThrow<string>("LLM_BASE_URL").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.getOrThrow<string>("LLM_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.getOrThrow<string>("LLM_MODEL"),
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with HTTP ${response.status}`);
    }

    const completion = completionSchema.parse(await response.json());
    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("LLM response did not include a completion");
    }
    return content;
  }
}

@Injectable()
export class LlmClientMock implements LlmClient {
  async complete(params: Parameters<LlmClient["complete"]>[0]): Promise<string> {
    const question = [...params.messages].reverse().find((message) => message.role === "user")?.content;
    return `Mock LLM answer for: ${question ?? "empty question"}`;
  }
}
