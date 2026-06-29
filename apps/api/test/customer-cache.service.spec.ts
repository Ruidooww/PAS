import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerCacheService } from "../src/customer/customer-cache.service";

type MockRedisClient = {
  status: string;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};

const redisMock = vi.hoisted(() => {
  const instances: MockRedisClient[] = [];
  const ctor = vi.fn((_url: string, _options: unknown) => {
    const client: MockRedisClient = {
      status: "wait",
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
      del: vi.fn(async () => 1),
      quit: vi.fn(async () => "OK"),
      connect: vi.fn(async () => {
        client.status = "ready";
      }),
    };
    instances.push(client);
    return client;
  });
  return { ctor, instances };
});

vi.mock("ioredis", () => ({ default: redisMock.ctor }));

describe("CustomerCacheService", () => {
  beforeEach(() => {
    redisMock.ctor.mockClear();
    redisMock.instances.length = 0;
  });

  it("connects lazily on first use instead of during construction", async () => {
    const service = new CustomerCacheService({
      getOrThrow: vi.fn(() => "redis://localhost:6399"),
    } as never);

    expect(redisMock.ctor).not.toHaveBeenCalled();

    await service.get("list:::1");

    const client = redisMock.instances[0];
    if (!client) throw new Error("Expected Redis client to be created");
    expect(redisMock.ctor).toHaveBeenCalledWith("redis://localhost:6399", {
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("customer:list:::1");

    await service.set("list:::1", { items: [] }, 60);

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(
      "customer:list:::1",
      JSON.stringify({ items: [] }),
      "EX",
      60,
    );
  });
});
