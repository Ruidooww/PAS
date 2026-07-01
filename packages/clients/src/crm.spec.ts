import { describe, expect, it, vi } from "vitest";

import {
  CrmClientError,
  ExternalCrmClient,
  MockCrmClient,
  PasCrmClient,
} from "./index";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("MockCrmClient", () => {
  it("returns the seeded customer and rejects unknown refs as 404", async () => {
    const client = new MockCrmClient();
    await expect(client.getCustomer("cust-acme")).resolves.toMatchObject({
      ref: "cust-acme",
      name: "Acme 制造",
    });
    await expect(client.getCustomer("missing")).rejects.toMatchObject({
      name: "CrmClientError",
      status: 404,
      provider: "mock",
    });
  });

  it("filters list by q (matches name or ref, case insensitive) and ownerId", async () => {
    const client = new MockCrmClient();
    const byName = await client.listCustomers({ q: "Acme" });
    expect(byName.map((c) => c.ref)).toEqual(["cust-acme"]);
    const byRef = await client.listCustomers({ q: "hyya" });
    expect(byRef.map((c) => c.ref)).toEqual(["cust-hyya"]);
    const byOwner = await client.listCustomers({ ownerId: "user-1" });
    expect(byOwner).toHaveLength(7);
    const byOwnerMissing = await client.listCustomers({ ownerId: "user-2" });
    expect(byOwnerMissing).toEqual([]);
  });

  it("filters opportunities by customerRef and stage", async () => {
    const client = new MockCrmClient();
    const all = await client.listOpportunities({});
    expect(all).toHaveLength(10);
    const byCustomer = await client.listOpportunities({ customerRef: "cust-acme" });
    expect(byCustomer.map((opp) => opp.ref)).toEqual(["opp-acme-dlp"]);
    const byStage = await client.listOpportunities({ stage: "evaluation" });
    expect(byStage.map((opp) => opp.ref)).toEqual([
      "opp-hyya-pilot",
      "opp-huaguang-encrypt",
      "opp-yuanchuang-gxp",
    ]);
    await expect(client.getOpportunity("missing")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns custom seed data when provided", async () => {
    const client = new MockCrmClient({
      customers: [
        {
          ref: "cust-x",
          name: "Custom X",
          industry: null,
          scale: null,
          ownerId: null,
        },
      ],
      opportunities: [],
    });
    expect((await client.listCustomers({})).map((c) => c.ref)).toEqual(["cust-x"]);
    expect(await client.listOpportunities({})).toEqual([]);
  });

  it("upserts mock opportunities so demos can create records", async () => {
    const client = new MockCrmClient();

    await expect(
      client.upsertOpportunity({
        ref: "opp-demo-created",
        customerRef: "cust-acme",
        title: "Acme 新增终端安全扩容",
        stage: "qualified",
        amountEstimate: 300_000,
        ownerId: "user-1",
      }),
    ).resolves.toMatchObject({
      ref: "opp-demo-created",
      title: "Acme 新增终端安全扩容",
    });

    await expect(client.getOpportunity("opp-demo-created")).resolves.toMatchObject({
      ref: "opp-demo-created",
      stage: "qualified",
    });
  });
});

describe("ExternalCrmClient", () => {
  it("issues bearer-authorized GETs and parses customer payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ref: "cust-1",
        name: "Acme",
        industry: "Mfg",
        scale: 1000,
        ownerId: "user-1",
      }),
    );
    const client = new ExternalCrmClient({
      baseUrl: "https://crm.example.com/api/",
      apiKey: "key-123",
      fetchImpl,
    });

    const customer = await client.getCustomer("cust-1");
    expect(customer).toMatchObject({ ref: "cust-1", name: "Acme" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://crm.example.com/api/customers/cust-1");
    expect((init as RequestInit).headers).toEqual({
      Authorization: "Bearer key-123",
    });
  });

  it("forwards list query params as URL search params", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new ExternalCrmClient({
      baseUrl: "https://crm.example.com",
      apiKey: "k",
      fetchImpl,
    });
    await client.listCustomers({ q: "acme", page: 2, ownerId: "user-1" });
    const [url] = fetchImpl.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/customers");
    expect(parsed.searchParams.get("q")).toBe("acme");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("ownerId")).toBe("user-1");
  });

  it("throws CrmClientError with status 429 when the upstream rate-limits", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "rate limited" }, 429));
    const client = new ExternalCrmClient({
      baseUrl: "https://crm.example.com",
      apiKey: "k",
      fetchImpl,
    });
    await expect(client.listCustomers({})).rejects.toMatchObject({
      name: "CrmClientError",
      status: 429,
      provider: "external",
    });
  });

  it("rejects payloads that do not match the customer shape", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ref: 123, name: null }));
    const client = new ExternalCrmClient({
      baseUrl: "https://crm.example.com",
      apiKey: "k",
      fetchImpl,
    });
    await expect(client.getCustomer("bad")).rejects.toBeInstanceOf(CrmClientError);
  });

  it("fetches a single opportunity via getOpportunity", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ref: "opp-1",
        customerRef: "cust-1",
        title: "Deal",
        stage: "discovery",
        amountEstimate: 100,
        ownerId: "user-1",
      }),
    );
    const client = new ExternalCrmClient({
      baseUrl: "https://crm.example.com",
      apiKey: "k",
      fetchImpl,
    });
    const opp = await client.getOpportunity("opp-1");
    expect(opp).toMatchObject({ ref: "opp-1", amountEstimate: 100 });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "https://crm.example.com/opportunities/opp-1",
    );
  });
});

describe("PasCrmClient", () => {
  it("rejects all methods as phase-two NotImplemented", async () => {
    const client = new PasCrmClient();
    await expect(client.getCustomer("x")).rejects.toMatchObject({
      provider: "pas",
    });
    await expect(client.listCustomers({})).rejects.toMatchObject({
      provider: "pas",
    });
    await expect(client.getOpportunity("y")).rejects.toMatchObject({
      provider: "pas",
    });
    await expect(client.listOpportunities({})).rejects.toMatchObject({
      provider: "pas",
    });
  });
});
