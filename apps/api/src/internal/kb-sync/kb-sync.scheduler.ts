import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker, type JobsOptions } from "bullmq";

import { bullmqRedisOptions } from "../../proposal-worker/redis-connection";
import { KbSyncService } from "./kb-sync.service";

const KB_SYNC_QUEUE_NAME = "kb-sync";
const KB_SYNC_JOB_NAME = "kb-sync.run";
const KB_SYNC_ATTEMPTS = 3;

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
      { connection, concurrency: 1 },
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
    const finalAttempt = job.attemptsMade >= KB_SYNC_ATTEMPTS - 1;
    return this.kbSyncService.runOnce({
      recordFailures: finalAttempt,
      throwOnFailure: !finalAttempt,
    });
  }

  private repeatJobOptions(): JobsOptions {
    return {
      jobId: KB_SYNC_JOB_NAME,
      repeat: { pattern: this.config.get<string>("PAS_KB_SYNC_CRON") ?? "0 * * * *" },
      attempts: KB_SYNC_ATTEMPTS,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    };
  }

  private isEnabled(): boolean {
    const value = this.config.get<boolean | string>("PAS_KB_SYNC_ENABLED");
    if (typeof value === "string") return value.trim().toLowerCase() !== "false";
    return value ?? true;
  }
}
