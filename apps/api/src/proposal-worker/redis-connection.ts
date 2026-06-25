import type { RedisOptions } from "ioredis";

export function bullmqRedisOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const dbPath = url.pathname.replace(/^\//, "");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(dbPath ? { db: Number(dbPath) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  };
}
