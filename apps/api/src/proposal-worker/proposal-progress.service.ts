import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";
import { Observable } from "rxjs";

import type { ProposalProgressEvent } from "./proposal-worker.types";

@Injectable()
export class ProposalProgressService implements OnModuleDestroy {
  private readonly redisUrl: string;
  private readonly subscribers = new Set<IORedis>();
  private publisher?: IORedis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.redisUrl = config.getOrThrow<string>("REDIS_URL");
  }

  async publish(proposalId: string, event: ProposalProgressEvent): Promise<void> {
    this.publisher ??= this.createRedis();
    await this.publisher.publish(progressChannel(proposalId), JSON.stringify(event));
  }

  stream(proposalId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const redis = this.createRedis();
      const channel = progressChannel(proposalId);
      this.subscribers.add(redis);

      const onMessage = (receivedChannel: string, payload: string) => {
        if (receivedChannel !== channel) return;
        subscriber.next({ data: JSON.parse(payload) } as MessageEvent);
      };
      redis.on("message", onMessage);
      void redis.subscribe(channel).catch((error: unknown) => subscriber.error(error));

      return () => {
        redis.off("message", onMessage);
        this.subscribers.delete(redis);
        void redis.unsubscribe(channel).finally(() => redis.quit());
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    const clients = [...this.subscribers];
    this.subscribers.clear();
    await Promise.all(clients.map((client) => client.quit()));
    if (this.publisher) await this.publisher.quit();
  }

  private createRedis(): IORedis {
    return new IORedis(this.redisUrl, {
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }
}

export function progressChannel(proposalId: string): string {
  return `proposal:${proposalId}:progress`;
}
