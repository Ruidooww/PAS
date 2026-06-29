import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker, type JobsOptions } from "bullmq";

import { runtimeConfig } from "../../config/runtime";
import { bullmqRedisOptions } from "../../proposal-worker/redis-connection";
import { KbSyncService } from "./kb-sync.service";

const KB_SYNC_QUEUE_NAME = "kb-sync";
const KB_SYNC_JOB_NAME = "kb-sync.run";

@Injectable()
export class KbSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KbSyncScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(KbSyncService) private readonly kbSyncService: KbSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>("NODE_ENV") === "test") return;
    if (!this.isEnabled()) {
      this.logger.log("KB sync scheduler disabled");
      return;
    }

    const connection = bullmqRedisOptions(this.config.getOrThrow<string>("REDIS_URL"));
    this.queue = new Queue(KB_SYNC_QUEUE_NAME, { connection });
    this.worker = new Worker(
      KB_SYNC_QUEUE_NAME,
      async (job) => this.processJob(job),
      { connection, concurrency: runtimeConfig.kbSync.workerConcurrency },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.warn(
        `KB sync job ${job?.id ?? "unknown"} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    await this.queue.add(KB_SYNC_JOB_NAME, {}, this.repeatJobOptions());
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async processJob(job: Job): Promise<unknown> {
    const finalAttempt = job.attemptsMade >= runtimeConfig.kbSync.attempts - 1;
    return this.kbSyncService.runOnce({
      recordFailures: finalAttempt,
      throwOnFailure: !finalAttempt,
    });
  }

  private repeatJobOptions(): JobsOptions {
    return {
      jobId: KB_SYNC_JOB_NAME,
      repeat: { pattern: runtimeConfig.kbSync.cron },
      attempts: runtimeConfig.kbSync.attempts,
      backoff: { type: "exponential", delay: runtimeConfig.kbSync.backoffDelayMs },
      removeOnComplete: runtimeConfig.kbSync.queue.removeOnComplete,
      removeOnFail: runtimeConfig.kbSync.queue.removeOnFail,
    };
  }

  private isEnabled(): boolean {
    return runtimeConfig.kbSync.enabled;
  }
}
