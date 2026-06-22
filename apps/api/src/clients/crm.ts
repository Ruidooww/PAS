import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Customer, Opportunity } from "@pas/shared";
import { z } from "zod";

export const CRM_CLIENT = Symbol("CRM_CLIENT");

export interface CrmClient {
  getCustomer(ref: string): Promise<Customer>;
  listCustomers(params: { q?: string; ownerId?: string; page?: number }): Promise<Customer[]>;
  listOpportunities(params: {
    customerRef?: string;
    stage?: string;
    page?: number;
  }): Promise<Opportunity[]>;
}

const customerSchema = z.object({
  ref: z.string(),
  name: z.string(),
  industry: z.string().nullable(),
  scale: z.number().int().nullable(),
  ownerId: z.string().nullable(),
});

const opportunitySchema = z.object({
  ref: z.string(),
  customerRef: z.string(),
  title: z.string(),
  stage: z.string(),
  amountEstimate: z.number().nullable(),
  ownerId: z.string().nullable(),
});

@Injectable()
export class ExternalCrmClient implements CrmClient {
  constructor(private readonly config: ConfigService) {}

  async getCustomer(ref: string): Promise<Customer> {
    return customerSchema.parse(await this.get(`/customers/${encodeURIComponent(ref)}`));
  }

  async listCustomers(params: Parameters<CrmClient["listCustomers"]>[0]): Promise<Customer[]> {
    return z.array(customerSchema).parse(await this.get("/customers", params));
  }

  async listOpportunities(
    params: Parameters<CrmClient["listOpportunities"]>[0],
  ): Promise<Opportunity[]> {
    return z.array(opportunitySchema).parse(await this.get("/opportunities", params));
  }

  private async get(path: string, query: Record<string, string | number | undefined> = {}): Promise<unknown> {
    const baseUrl = this.config.getOrThrow<string>("CRM_BASE_URL").replace(/\/$/, "");
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.getOrThrow<string>("CRM_API_KEY")}` },
    });
    if (!response.ok) {
      throw new Error(`CRM request failed with HTTP ${response.status}`);
    }
    return response.json();
  }
}

@Injectable()
export class PasCrmClient implements CrmClient {
  getCustomer(_ref: string): Promise<Customer> {
    return this.stageTwo();
  }

  listCustomers(_params: Parameters<CrmClient["listCustomers"]>[0]): Promise<Customer[]> {
    return this.stageTwo();
  }

  listOpportunities(
    _params: Parameters<CrmClient["listOpportunities"]>[0],
  ): Promise<Opportunity[]> {
    return this.stageTwo();
  }

  private stageTwo<T>(): Promise<T> {
    return Promise.reject(new Error("PAS-native CRM is reserved for phase two"));
  }
}

@Injectable()
export class CrmClientMock implements CrmClient {
  async getCustomer(ref: string): Promise<Customer> {
    return { ref, name: "Mock Customer", industry: null, scale: null, ownerId: null };
  }

  async listCustomers(_params: Parameters<CrmClient["listCustomers"]>[0]): Promise<Customer[]> {
    return [await this.getCustomer("mock-customer")];
  }

  async listOpportunities(
    params: Parameters<CrmClient["listOpportunities"]>[0],
  ): Promise<Opportunity[]> {
    return [
      {
        ref: "mock-opportunity",
        customerRef: params.customerRef ?? "mock-customer",
        title: "Mock Opportunity",
        stage: params.stage ?? "discovery",
        amountEstimate: null,
        ownerId: null,
      },
    ];
  }
}
