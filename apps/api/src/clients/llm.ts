import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChatMessage } from "@pas/shared";
import { z } from "zod";

export const LLM_CLIENT = Symbol("LLM_CLIENT");

export interface LlmClient {
  complete(params: { messages: ChatMessage[]; temperature?: number }): Promise<string>;
  stream(params: { messages: ChatMessage[]; temperature?: number }): AsyncIterable<string>;
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

  async *stream(params: Parameters<LlmClient["stream"]>[0]): AsyncIterable<string> {
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
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM stream request failed with HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("LLM stream response did not include a body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const delta = parseStreamFrame(frame);
          if (delta) yield delta;
        }
      }
      const tail = parseStreamFrame(buffer);
      if (tail) yield tail;
    } finally {
      reader.releaseLock();
    }
  }
}

@Injectable()
export class LlmClientMock implements LlmClient {
  async complete(params: Parameters<LlmClient["complete"]>[0]): Promise<string> {
    const question = [...params.messages].reverse().find((message) => message.role === "user")?.content;
    return `Mock LLM answer for: ${question ?? "empty question"}`;
  }

  async *stream(params: Parameters<LlmClient["stream"]>[0]): AsyncIterable<string> {
    yield await this.complete(params);
  }
}

function parseStreamFrame(frame: string): string | undefined {
  for (const line of frame.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;
    const parsed = streamChunkSchema.safeParse(JSON.parse(data));
    const content = parsed.success ? parsed.data.choices[0]?.delta.content : undefined;
    if (content) return content;
  }
  return undefined;
}

const streamChunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z.object({ content: z.string().optional() }),
    }),
  ),
});
