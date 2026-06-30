import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { runtimeConfig } from "../../config/runtime";
import { bullmqRedisOptions } from "../../proposal-worker/redis-connection";
import { KG_EXTRACT_QUEUE_NAME } from "./kg-extract.constants";
import { KgExtractService } from "./kg-extract.service";
import type { KgExtractJob } from "./kg-extract.types";

@Injectable()
export class KgExtractWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KgExtractWorker.name);
  private worker?: Worker;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(KgExtractService) private readonly kgExtract: KgExtractService,
  ) {}

  onModuleInit(): void {
    if (this.config.getOrThrow<string>("NODE_ENV") === "test") return;
    this.worker = new Worker(
      KG_EXTRACT_QUEUE_NAME,
      async (job) => this.kgExtract.extractDocument((job.data as KgExtractJob).kbDocId),
      {
        connection: bullmqRedisOptions(this.config.getOrThrow<string>("REDIS_URL")),
        concurrency: runtimeConfig.kg.extract.workerConcurrency,
      },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.warn(
        `KG extraction job ${job?.id ?? "unknown"} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
