import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";

import { runtimeConfig } from "../config/runtime";

const KEY_PREFIX = "customer:";

@Injectable()
export class CustomerCacheService implements OnModuleDestroy {
  private readonly redisUrl: string;
  private client?: IORedis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.redisUrl = config.getOrThrow<string>("REDIS_URL");
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis().get(this.namespaced(key));
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
    await this.redis().set(this.namespaced(key), JSON.stringify(value), "EX", ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await this.redis().del(this.namespaced(key));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit();
  }

  private redis(): IORedis {
    this.client ??= new IORedis(this.redisUrl, {
      enableReadyCheck: false,
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    return this.client;
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
