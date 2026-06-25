import IORedis from "ioredis";
import { describe, expect, it } from "vitest";

import { progressChannel } from "../src/proposal-worker/proposal-progress.service";

describe("proposal progress Redis integration", () => {
  it.skip("round-trips a progress event through the configured Redis pub/sub channel", async () => {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6399";
    const publisher = new IORedis(redisUrl);
    const subscriber = new IORedis(redisUrl);
    const channel = progressChannel("integration-proposal");
    const received = new Promise<string>((resolve) => {
      subscriber.on("message", (receivedChannel, payload) => {
        if (receivedChannel === channel) resolve(payload);
      });
    });

    try {
      await subscriber.subscribe(channel);
      await publisher.publish(channel, JSON.stringify({ chapter: "overview", n: 1, total: 7 }));
      await expect(received).resolves.toBe(
        JSON.stringify({ chapter: "overview", n: 1, total: 7 }),
      );
    } finally {
      await subscriber.quit();
      await publisher.quit();
    }
  });
});
