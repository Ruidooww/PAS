import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";

import { runtimeConfig } from "../config/runtime";

const KEY_PREFIX = "customer:";

@Injectable()
export class CustomerCacheService implements OnModuleDestroy {
  private readonly redisUrl: string;
  private client?: IORedis;
  private connectPromise?: Promise<void>;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.redisUrl = config.getOrThrow<string>("REDIS_URL");
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await (await this.redis()).get(this.namespaced(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = runtimeConfig.cache.crmTtlSeconds,
  ): Promise<void> {
    await (await this.redis()).set(this.namespaced(key), JSON.stringify(value), "EX", ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await (await this.redis()).del(this.namespaced(key));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit();
  }

  private async redis(): Promise<IORedis> {
    const client = this.client ??= new IORedis(this.redisUrl, {
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    if (client.status === "wait" || client.status === "end") {
      this.connectPromise ??= client.connect().finally(() => {
        this.connectPromise = undefined;
      });
      await this.connectPromise;
    }
    return client;
  }

  private namespaced(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }
}

export function customerListKey(params: {
  q?: string;
  ownerId?: string;
  page?: number;
}): string {
  return `list:${normalize(params.q)}:${normalize(params.ownerId)}:${params.page ?? 1}`;
}

export function customerDetailKey(ref: string): string {
  return `detail:${ref}`;
}

export function opportunityListKey(params: {
  customerRef?: string;
  stage?: string;
  page?: number;
}): string {
  return `opp:list:${normalize(params.customerRef)}:${normalize(params.stage)}:${params.page ?? 1}`;
}

export function opportunityDetailKey(ref: string): string {
  return `opp:detail:${ref}`;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
