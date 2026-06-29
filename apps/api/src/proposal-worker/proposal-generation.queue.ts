import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

import { runtimeConfig } from "../config/runtime";
import { PROPOSAL_QUEUE_NAME } from "./proposal-worker.constants";
import type { ProposalGenerationJob } from "./proposal-worker.types";
import { bullmqRedisOptions } from "./redis-connection";

@Injectable()
export class ProposalGenerationQueue implements OnModuleDestroy {
  private readonly queue?: Queue;

  constructor(@Inject(ConfigService) config: ConfigService) {
    if (config.getOrThrow<string>("NODE_ENV") === "test") return;
    this.queue = new Queue(PROPOSAL_QUEUE_NAME, {
      connection: bullmqRedisOptions(config.getOrThrow<string>("REDIS_URL")),
    });
  }

  async enqueue(data: ProposalGenerationJob): Promise<void> {
    if (!this.queue) {
      throw new Error("Proposal generation queue is disabled in test mode");
    }
    await this.queue.add(PROPOSAL_QUEUE_NAME, data, {
      removeOnComplete: runtimeConfig.proposal.queue.removeOnComplete,
      removeOnFail: runtimeConfig.proposal.queue.removeOnFail,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) await this.queue.close();
  }
}
