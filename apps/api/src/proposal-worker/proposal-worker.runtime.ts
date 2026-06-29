import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { runtimeConfig } from "../config/runtime";
import { ProposalGenerationService } from "./proposal-generation.service";
import { PROPOSAL_QUEUE_NAME } from "./proposal-worker.constants";
import type { ProposalGenerationJob } from "./proposal-worker.types";
import { bullmqRedisOptions } from "./redis-connection";

@Injectable()
export class ProposalWorkerRuntime implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ProposalGenerationService)
    private readonly generation: ProposalGenerationService,
  ) {}

  onModuleInit(): void {
    if (this.config.getOrThrow<string>("NODE_ENV") === "test") return;
    this.worker = new Worker(
      PROPOSAL_QUEUE_NAME,
      async (job) => {
        await this.generation.generate(job.data as ProposalGenerationJob);
      },
      {
        connection: bullmqRedisOptions(
          this.config.getOrThrow<string>("REDIS_URL"),
        ),
        concurrency: runtimeConfig.proposal.workerConcurrency,
      },
    );
    this.worker.on("error", (error) => {
      console.error("Proposal worker error", error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await this.worker.close();
  }
}
