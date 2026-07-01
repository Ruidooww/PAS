import { randomUUID } from "node:crypto";

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CrmClient } from "@pas/clients/crm";
import { CrmClientError } from "@pas/clients/crm";
import type { CustomerSource, ProposalStatus } from "@pas/shared";

import type { SessionClaims } from "../auth/types";
import { CRM_CLIENT } from "../clients/crm";
import { AclService } from "../internal/acl.service";
import { FieldAclService } from "../internal/acl/field-acl.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CustomerCacheService,
  customerDetailKey,
  customerListKey,
  opportunityDetailKey,
  opportunityListKey,
} from "./customer-cache.service";
import {
  CustomerDetailDto,
  CustomerDto,
  type CustomerListResponse,
  type CustomerPortraitDto,
  type CustomerProposalSummary,
  OpportunityDto,
  type OpportunityListResponse,
} from "./customer.dto";
import type {
  CreateOpportunityDto,
  CustomerListQuery,
  OpportunityListQuery,
} from "./customer.schema";

@Injectable()
export class CustomerService {
  private readonly crmProvider: string;
  private readonly source: CustomerSource;

  constructor(
    @Inject(CRM_CLIENT) private readonly crm: CrmClient,
    @Inject(CustomerCacheService) private readonly cache: CustomerCacheService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AclService) private readonly acl: AclService,
    @Inject(FieldAclService) private readonly fieldAcl: FieldAclService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.crmProvider = config.getOrThrow<string>("CRM_PROVIDER");
    this.source = this.crmProvider === "pas" ? "pas" : "external";
  }

  async list(query: CustomerListQuery, user: SessionClaims): Promise<CustomerListResponse> {
    const cacheKey = customerListKey(query);
    try {
      const fresh = await this.crm.listCustomers(query);
      const items = fresh.map((customer) => new CustomerDto(customer, this.source));
      const response: CustomerListResponse = {
        items: await this.filterCustomerItems(items, user),
        page: query.page,
      };
      await this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      const cached = await this.fallbackToCache<CustomerListResponse>(cacheKey, error);
      if (cached) {
        return {
          ...cached,
          items: await this.filterCustomerItems(cached.items, user),
          fromCache: true,
        };
      }
      throw error;
    }
  }

  async detail(ref: string, user: SessionClaims): Promise<CustomerDetailDto> {
    const cacheKey = customerDetailKey(ref);
    let customer;
    try {
      customer = await this.crm.getCustomer(ref);
    } catch (error) {
      if (this.isNotFound(error)) throw new NotFoundException(`Customer not found: ${ref}`);
      const cached = await this.fallbackToCache<CustomerDetailDto>(cacheKey, error);
      if (cached) {
        return this.filterCustomerDetail(ref, cached, user);
      }
      throw error;
    }

    const mirror = await this.prisma.customerMirror.upsert({
      where: { ref },
      create: {
        ref,
        source: this.source,
        name: customer.name,
        industry: customer.industry,
        scale: customer.scale,
        ownerId: customer.ownerId,
        syncedAt: new Date(),
      },
      update: {
        source: this.source,
        name: customer.name,
        industry: customer.industry,
        scale: customer.scale,
        ownerId: customer.ownerId,
        syncedAt: new Date(),
      },
    });

    const proposals = await this.visibleProposalsForCustomer(ref, user);
    const detail = new CustomerDetailDto(customer, this.source, mirror.syncedAt, proposals);
    await this.cache.set(cacheKey, detail);
    return this.filterCustomerDetail(ref, detail, user);
  }

  async listOpportunities(query: OpportunityListQuery): Promise<OpportunityListResponse> {
    const cacheKey = opportunityListKey(query);
    try {
      const fresh = await this.crm.listOpportunities(query);
      const items = fresh.map((opportunity) => new OpportunityDto(opportunity));
      const response: OpportunityListResponse = { items, page: query.page };
      await this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      const cached = await this.fallbackToCache<OpportunityListResponse>(cacheKey, error);
      if (cached) return { ...cached, fromCache: true };
      throw error;
    }
  }

  async getOpportunity(ref: string): Promise<OpportunityDto> {
    const cacheKey = opportunityDetailKey(ref);
    try {
      const fresh = await this.crm.getOpportunity(ref);
      const dto = new OpportunityDto(fresh);
      await this.cache.set(cacheKey, dto);
      return dto;
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException(`Opportunity not found: ${ref}`);
      }
      const cached = await this.fallbackToCache<OpportunityDto>(cacheKey, error);
      if (cached) return new OpportunityDto(cached);
      throw error;
    }
  }

  async createOpportunity(
    data: CreateOpportunityDto,
    user: SessionClaims,
  ): Promise<OpportunityDto> {
    this.assertCanCreateOpportunity(user);
    if (this.crmProvider !== "mock") {
      throw new NotImplementedException("CRM opportunity writes are only implemented for mock CRM");
    }
    const opportunity = await this.crm.upsertOpportunity({
      ref: `opp-${randomUUID().replace(/-/g, "")}`,
      customerRef: data.customerRef,
      title: data.title,
      stage: data.stage,
      amountEstimate: data.amountEstimate,
      ownerId: user.uid,
    });
    return new OpportunityDto(opportunity);
  }

  async getCustomerPortrait(
    ref: string,
    user: SessionClaims,
  ): Promise<CustomerPortraitDto> {
    let customer;
    try {
      customer = await this.crm.getCustomer(ref);
    } catch (error) {
      if (this.isNotFound(error)) throw new NotFoundException(`Customer not found: ${ref}`);
      throw error;
    }

    const [opportunities, proposals] = await Promise.all([
      this.crm.listOpportunities({ customerRef: ref }),
      this.visibleProposalsForCustomer(ref, user),
    ]);
    const portrait: CustomerPortraitDto = {
      ref: customer.ref,
      name: customer.name,
      industry: customer.industry,
      scale: customer.scale,
      ownerId: customer.ownerId,
      opportunities: {
        total: opportunities.length,
        byStage: countOpportunitiesByStage(opportunities),
        latestUpdatedAt: latestOpportunityUpdatedAt(opportunities),
        totalAmountEstimate: opportunities.reduce(
          (sum, opportunity) => sum + (opportunity.amountEstimate ?? 0),
          0,
        ),
      },
      proposals: {
        total: proposals.length,
        latestStatus: proposals[0]?.status ?? null,
        latestUpdatedAt: proposals[0]?.createdAt ?? null,
      },
    };
    return (await this.fieldAcl.filterFields(
      "customer",
      ref,
      portrait as unknown as Record<string, unknown>,
      user,
    )) as unknown as CustomerPortraitDto;
  }

  private async visibleProposalsForCustomer(
    customerRef: string,
    user: SessionClaims,
  ): Promise<CustomerProposalSummary[]> {
    const visibleIds = await this.acl.computeVisibleProposalIds(user);
    if (visibleIds.length === 0) return [];
    const proposals = await this.prisma.proposal.findMany({
      where: {
        id: { in: visibleIds },
        customerRef,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        createdAt: true,
      },
    });
    return proposals.map((proposal): CustomerProposalSummary => ({
      id: proposal.id,
      title: proposal.title,
      status: proposal.status as ProposalStatus,
      version: proposal.version,
      createdAt: proposal.createdAt.toISOString(),
    }));
  }

  private async filterCustomerItems(
    items: CustomerDto[],
    user: SessionClaims,
  ): Promise<CustomerDto[]> {
    return Promise.all(
      items.map(async (item) =>
        (await this.fieldAcl.filterFields(
          "customer",
          item.ref,
          item as unknown as Record<string, unknown>,
          user,
        )) as unknown as CustomerDto,
      ),
    );
  }

  private async filterCustomerDetail(
    ref: string,
    detail: CustomerDetailDto,
    user: SessionClaims,
  ): Promise<CustomerDetailDto> {
    return (await this.fieldAcl.filterFields(
      "customer",
      ref,
      detail as unknown as Record<string, unknown>,
      user,
    )) as unknown as CustomerDetailDto;
  }

  private async fallbackToCache<T>(cacheKey: string, error: unknown): Promise<T | null> {
    if (!this.shouldFallback(error)) return null;
    return this.cache.get<T>(cacheKey);
  }

  private shouldFallback(error: unknown): boolean {
    if (error instanceof CrmClientError && error.status === 429) return true;
    return false;
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof CrmClientError && error.status === 404;
  }

  private assertCanCreateOpportunity(user: SessionClaims): void {
    if (user.isExternal || user.role === "external") {
      throw new ForbiddenException("External users cannot create opportunities");
    }
    if (user.role !== "admin" && user.role !== "presales") {
      throw new ForbiddenException("Only admin and presales users can create opportunities");
    }
  }
}

function countOpportunitiesByStage(
  opportunities: Array<{ stage: string }>,
): Record<string, number> {
  return opportunities.reduce<Record<string, number>>((acc, opportunity) => {
    acc[opportunity.stage] = (acc[opportunity.stage] ?? 0) + 1;
    return acc;
  }, {});
}

function latestOpportunityUpdatedAt(opportunities: unknown[]): string | null {
  const timestamps = opportunities
    .map((opportunity) => {
      const value =
        (opportunity as { updatedAt?: Date | string | null; createdAt?: Date | string | null })
          .updatedAt ??
        (opportunity as { createdAt?: Date | string | null }).createdAt;
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    })
    .filter((value): value is string => value !== null)
    .sort()
    .reverse();
  return timestamps[0] ?? null;
}
