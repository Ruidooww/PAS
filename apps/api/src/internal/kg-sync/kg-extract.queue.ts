import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

import { runtimeConfig } from "../../config/runtime";
import { bullmqRedisOptions } from "../../proposal-worker/redis-connection";
import { KG_EXTRACT_JOB_NAME, KG_EXTRACT_QUEUE_NAME } from "./kg-extract.constants";
import type { KgExtractJob } from "./kg-extract.types";

@Injectable()
export class KgExtractQueue implements OnModuleDestroy {
  private readonly queue?: Queue;

  constructor(@Inject(ConfigService) config: ConfigService) {
    if (config.getOrThrow<string>("NODE_ENV") === "test") return;
    this.queue = new Queue(KG_EXTRACT_QUEUE_NAME, {
      connection: bullmqRedisOptions(config.getOrThrow<string>("REDIS_URL")),
    });
  }

  async enqueue(data: KgExtractJob): Promise<void> {
    if (!this.queue) {
      throw new Error("KG extraction queue is disabled in test mode");
    }
    await this.queue.add(KG_EXTRACT_JOB_NAME, data, {
      attempts: runtimeConfig.kg.extract.attempts,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
