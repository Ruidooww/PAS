import type { Customer, Opportunity } from "@pas/shared";

export type IdpProvider = "feishu" | "mock" | "wecom";

export interface UserProfile {
  idpUserId: string;
  name: string;
  email?: string;
  avatar?: string;
  deptIds?: string[];
}

export interface AuthUrlParams {
  state: string;
  redirectUri: string;
}

export interface ExchangeCodeParams {
  code: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  openId: string;
  expiresIn?: number;
  refreshToken?: string;
}

export interface UserInfoParams {
  accessToken: string;
}

export interface IdpClient {
  getAuthUrl(params: AuthUrlParams): string;
  exchangeCode(params: ExchangeCodeParams): Promise<TokenExchangeResult>;
  getUserInfo(params: UserInfoParams): Promise<UserProfile>;
}

type FetchImpl = typeof fetch;

export class IdpClientError extends Error {
  constructor(
    message: string,
    readonly provider: IdpProvider,
    readonly status?: number,
  ) {
    super(message);
    this.name = "IdpClientError";
  }
}

export interface MockIdpClientOptions {
  users?: UserProfile[];
  selectedUserId?: string;
}

const defaultMockUsers: UserProfile[] = [
  {
    idpUserId: "mock-user-1",
    name: "Mock 售前",
    email: "mock.presales@example.com",
    avatar: "https://example.com/mock-user-1.png",
    deptIds: ["dept-presales"],
  },
];

export class MockIdpClient implements IdpClient {
  private readonly users: Map<string, UserProfile>;
  private readonly selectedUserId: string;

  constructor(options: MockIdpClientOptions = {}) {
    const users = options.users ?? defaultMockUsers;
    this.users = new Map(users.map((u) => [u.idpUserId, u]));
    this.selectedUserId = options.selectedUserId ?? users[0]?.idpUserId ?? "mock-user-1";
  }

  getAuthUrl(params: AuthUrlParams): string {
    const url = new URL(params.redirectUri);
    url.searchParams.set("provider", "mock");
    url.searchParams.set("code", this.selectedUserId);
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  async exchangeCode(params: ExchangeCodeParams): Promise<TokenExchangeResult> {
    const user = this.users.get(params.code);
    if (!user) {
      throw new IdpClientError(`Unknown mock user code: ${params.code}`, "mock");
    }
    return { accessToken: `mock:${user.idpUserId}`, openId: user.idpUserId };
  }

  async getUserInfo(params: UserInfoParams): Promise<UserProfile> {
    const userId = params.accessToken.replace(/^mock:/, "");
    const user = this.users.get(userId);
    if (!user) {
      throw new IdpClientError(`Unknown mock access token: ${params.accessToken}`, "mock");
    }
    return user;
  }
}

export interface FeishuIdpClientOptions {
  appId: string;
  appSecret: string;
  fetchImpl?: FetchImpl;
  authBaseUrl?: string;
  apiBaseUrl?: string;
}

interface FeishuTokenResponse {
  code: number;
  msg?: string;
  data?: {
    access_token?: string;
    open_id?: string;
    expires_in?: number;
    refresh_token?: string;
  };
}

interface FeishuUserInfoResponse {
  code: number;
  msg?: string;
  data?: {
    open_id?: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    avatar_thumb?: string;
    department_ids?: string[];
  };
}

export class FeishuIdpClient implements IdpClient {
  private readonly fetchImpl: FetchImpl;
  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;

  constructor(private readonly options: FeishuIdpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.authBaseUrl = options.authBaseUrl ?? "https://accounts.feishu.cn";
    this.apiBaseUrl = options.apiBaseUrl ?? "https://open.feishu.cn";
  }

  getAuthUrl(params: AuthUrlParams): string {
    const url = new URL("/open-apis/authen/v1/index", this.authBaseUrl);
    url.searchParams.set("app_id", this.options.appId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  async exchangeCode(params: ExchangeCodeParams): Promise<TokenExchangeResult> {
    const response = await this.fetchJson<FeishuTokenResponse>(
      `${this.apiBaseUrl}/open-apis/authen/v2/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: this.options.appId,
          client_secret: this.options.appSecret,
          code: params.code,
        }),
      },
    );
    if (response.code !== 0 || !response.data?.access_token || !response.data.open_id) {
      throw new IdpClientError(
        `Feishu token exchange failed: ${response.msg ?? response.code}`,
        "feishu",
      );
    }
    return {
      accessToken: response.data.access_token,
      openId: response.data.open_id,
      expiresIn: response.data.expires_in,
      refreshToken: response.data.refresh_token,
    };
  }

  async getUserInfo(params: UserInfoParams): Promise<UserProfile> {
    const response = await this.fetchJson<FeishuUserInfoResponse>(
      `${this.apiBaseUrl}/open-apis/authen/v1/user_info`,
      { headers: { Authorization: `Bearer ${params.accessToken}` } },
    );
    const data = response.data;
    if (response.code !== 0 || !data?.open_id || !data.name) {
      throw new IdpClientError(`Feishu userinfo failed: ${response.msg ?? response.code}`, "feishu");
    }
    return {
      idpUserId: data.open_id,
      name: data.name,
      email: data.email,
      avatar: data.avatar_url ?? data.avatar_thumb,
      deptIds: data.department_ids,
    };
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      throw new IdpClientError(
        `Feishu HTTP ${response.status}: ${await response.text()}`,
        "feishu",
        response.status,
      );
    }
    return response.json() as Promise<T>;
  }
}

export interface WecomIdpClientOptions {
  corpId: string;
  agentId: string;
  appSecret: string;
  fetchImpl?: FetchImpl;
  authBaseUrl?: string;
  apiBaseUrl?: string;
}

interface WecomTokenResponse {
  errcode: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
}

interface WecomGetUserInfoResponse {
  errcode: number;
  errmsg?: string;
  UserId?: string;
  OpenId?: string;
  user_ticket?: string;
  expires_in?: number;
}

interface WecomUserDetailResponse {
  errcode: number;
  errmsg?: string;
  userid?: string;
  name?: string;
  email?: string;
  avatar?: string;
  department?: number[];
}

export class WecomIdpClient implements IdpClient {
  private readonly fetchImpl: FetchImpl;
  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;
  constructor(private readonly options: WecomIdpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.authBaseUrl = options.authBaseUrl ?? "https://open.weixin.qq.com";
    this.apiBaseUrl = options.apiBaseUrl ?? "https://qyapi.weixin.qq.com";
  }

  getAuthUrl(params: AuthUrlParams): string {
    const url = new URL("/connect/oauth2/authorize", this.authBaseUrl);
    url.searchParams.set("appid", this.options.corpId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "snsapi_privateinfo");
    url.searchParams.set("state", params.state);
    url.searchParams.set("agentid", this.options.agentId);
    return `${url.toString()}#wechat_redirect`;
  }

  async exchangeCode(params: ExchangeCodeParams): Promise<TokenExchangeResult> {
    const token = await this.fetchCorpToken();
    const infoUrl = new URL("/cgi-bin/auth/getuserinfo", this.apiBaseUrl);
    infoUrl.searchParams.set("access_token", token);
    infoUrl.searchParams.set("code", params.code);
    const info = await this.fetchJson<WecomGetUserInfoResponse>(infoUrl.toString());
    const openId = info.UserId ?? info.OpenId;
    if (info.errcode !== 0 || !openId || !info.user_ticket) {
      throw new IdpClientError(`WeCom getuserinfo failed: ${info.errmsg ?? info.errcode}`, "wecom");
    }
    return {
      accessToken: info.user_ticket,
      openId,
      expiresIn: info.expires_in,
    };
  }

  async getUserInfo(params: UserInfoParams): Promise<UserProfile> {
    const corpToken = await this.fetchCorpToken();
    const detail = await this.fetchJson<WecomUserDetailResponse>(
      `${this.apiBaseUrl}/cgi-bin/auth/getuserdetail?access_token=${encodeURIComponent(corpToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ticket: params.accessToken }),
      },
    );
    if (detail.errcode !== 0 || !detail.userid || !detail.name) {
      throw new IdpClientError(`WeCom getuserdetail failed: ${detail.errmsg ?? detail.errcode}`, "wecom");
    }
    return {
      idpUserId: detail.userid,
      name: detail.name,
      email: detail.email,
      avatar: detail.avatar,
      deptIds: detail.department?.map(String),
    };
  }

  private async fetchCorpToken(): Promise<string> {
    const tokenUrl = new URL("/cgi-bin/gettoken", this.apiBaseUrl);
    tokenUrl.searchParams.set("corpid", this.options.corpId);
    tokenUrl.searchParams.set("corpsecret", this.options.appSecret);
    const token = await this.fetchJson<WecomTokenResponse>(tokenUrl.toString());
    if (token.errcode !== 0 || !token.access_token) {
      throw new IdpClientError(`WeCom gettoken failed: ${token.errmsg ?? token.errcode}`, "wecom");
    }
    return token.access_token;
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      throw new IdpClientError(
        `WeCom HTTP ${response.status}: ${await response.text()}`,
        "wecom",
        response.status,
      );
    }
    return response.json() as Promise<T>;
  }
}

export type CrmProvider = "external" | "mock" | "pas";

export interface CrmListCustomersParams {
  q?: string;
  ownerId?: string;
  page?: number;
}

export interface CrmListOpportunitiesParams {
  customerRef?: string;
  stage?: string;
  page?: number;
}

export interface CrmClient {
  getCustomer(ref: string): Promise<Customer>;
  listCustomers(params: CrmListCustomersParams): Promise<Customer[]>;
  getOpportunity(ref: string): Promise<Opportunity>;
  listOpportunities(params: CrmListOpportunitiesParams): Promise<Opportunity[]>;
  upsertOpportunity(opportunity: Opportunity): Promise<Opportunity>;
}

export class CrmClientError extends Error {
  constructor(
    message: string,
    readonly provider: CrmProvider,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CrmClientError";
  }
}

function isCustomer(value: unknown): value is Customer {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.ref === "string" &&
    typeof record.name === "string" &&
    (record.industry === null || typeof record.industry === "string") &&
    (record.scale === null || typeof record.scale === "number") &&
    (record.ownerId === null || typeof record.ownerId === "string")
  );
}

function isOpportunity(value: unknown): value is Opportunity {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.ref === "string" &&
    typeof record.customerRef === "string" &&
    typeof record.title === "string" &&
    typeof record.stage === "string" &&
    (record.amountEstimate === null || typeof record.amountEstimate === "number") &&
    (record.ownerId === null || typeof record.ownerId === "string")
  );
}

export interface ExternalCrmClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: FetchImpl;
}

export class ExternalCrmClient implements CrmClient {
  private readonly fetchImpl: FetchImpl;
  private readonly baseUrl: string;

  constructor(private readonly options: ExternalCrmClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async getCustomer(ref: string): Promise<Customer> {
    const value = await this.get(`/customers/${encodeURIComponent(ref)}`);
    if (!isCustomer(value)) {
      throw new CrmClientError(`Invalid customer payload for ${ref}`, "external");
    }
    return value;
  }

  async listCustomers(params: CrmListCustomersParams): Promise<Customer[]> {
    const value = await this.get("/customers", { ...params });
    if (!Array.isArray(value) || !value.every(isCustomer)) {
      throw new CrmClientError("Invalid listCustomers payload", "external");
    }
    return value;
  }

  async getOpportunity(ref: string): Promise<Opportunity> {
    const value = await this.get(`/opportunities/${encodeURIComponent(ref)}`);
    if (!isOpportunity(value)) {
      throw new CrmClientError(`Invalid opportunity payload for ${ref}`, "external");
    }
    return value;
  }

  async listOpportunities(params: CrmListOpportunitiesParams): Promise<Opportunity[]> {
    const value = await this.get("/opportunities", { ...params });
    if (!Array.isArray(value) || !value.every(isOpportunity)) {
      throw new CrmClientError("Invalid listOpportunities payload", "external");
    }
    return value;
  }

  upsertOpportunity(_opportunity: Opportunity): Promise<Opportunity> {
    return Promise.reject(
      new CrmClientError("External CRM write is not implemented", "external", 501),
    );
  }

  private async get(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    if (!response.ok) {
      throw new CrmClientError(
        `CRM request failed with HTTP ${response.status}`,
        "external",
        response.status,
      );
    }
    return response.json();
  }
}

export class PasCrmClient implements CrmClient {
  getCustomer(_ref: string): Promise<Customer> {
    return this.stageTwo();
  }
  listCustomers(_params: CrmListCustomersParams): Promise<Customer[]> {
    return this.stageTwo();
  }
  getOpportunity(_ref: string): Promise<Opportunity> {
    return this.stageTwo();
  }
  listOpportunities(_params: CrmListOpportunitiesParams): Promise<Opportunity[]> {
    return this.stageTwo();
  }
  upsertOpportunity(_opportunity: Opportunity): Promise<Opportunity> {
    return this.stageTwo();
  }
  private stageTwo<T>(): Promise<T> {
    return Promise.reject(
      new CrmClientError("PAS-native CRM is reserved for phase two", "pas"),
    );
  }
}

export interface MockCrmClientOptions {
  customers?: Customer[];
  opportunities?: Opportunity[];
}

const defaultMockCustomers: Customer[] = [
  { ref: "cust-acme", name: "Acme 制造", industry: "制造业", scale: 1200, ownerId: "user-1" },
  { ref: "cust-hyya", name: "华义匀安演示客户", industry: "信息安全", scale: 500, ownerId: "user-1" },
  { ref: "cust-changjiang", name: "长江精密制造集团", industry: "高端装备制造", scale: 3500, ownerId: "user-1" },
  { ref: "cust-huaguang", name: "华光半导体设计", industry: "半导体设计", scale: 2200, ownerId: "user-1" },
  { ref: "cust-xingchen", name: "星辰航空科技", industry: "航空航天", scale: 1800, ownerId: "user-1" },
  { ref: "cust-yuanchuang", name: "元创医疗器械", industry: "医疗器械", scale: 1500, ownerId: "user-1" },
  { ref: "cust-hongyan", name: "鸿雁汽车电子", industry: "汽车电子", scale: 5000, ownerId: "user-1" },
];

const defaultMockOpportunities: Opportunity[] = [
  { ref: "opp-acme-dlp", customerRef: "cust-acme", title: "Acme 端点 DLP 一期", stage: "discovery", amountEstimate: 800000, ownerId: "user-1" },
  { ref: "opp-hyya-pilot", customerRef: "cust-hyya", title: "华义匀安 PAS 试点", stage: "evaluation", amountEstimate: 200000, ownerId: "user-1" },
  { ref: "opp-changjiang-full", customerRef: "cust-changjiang", title: "长江精密 IP-Guard 全模块建设", stage: "closed_won", amountEstimate: 2800000, ownerId: "user-1" },
  { ref: "opp-changjiang-expand", customerRef: "cust-changjiang", title: "长江精密二期扩容（研发部涉密图纸）", stage: "negotiation", amountEstimate: 800000, ownerId: "user-1" },
  { ref: "opp-huaguang-encrypt", customerRef: "cust-huaguang", title: "华光半导体 芯片设计文档加密与外发管控", stage: "evaluation", amountEstimate: 1500000, ownerId: "user-1" },
  { ref: "opp-xingchen-audit", customerRef: "cust-xingchen", title: "星辰航空 涉密审计合规（GB/T 22239-2019 三级）", stage: "discovery", amountEstimate: 2200000, ownerId: "user-1" },
  { ref: "opp-yuanchuang-gxp", customerRef: "cust-yuanchuang", title: "元创医疗 GxP 电子记录与签名管控", stage: "evaluation", amountEstimate: 900000, ownerId: "user-1" },
  { ref: "opp-yuanchuang-sensitive", customerRef: "cust-yuanchuang", title: "元创医疗 敏感数据识别扩展", stage: "discovery", amountEstimate: 400000, ownerId: "user-1" },
  { ref: "opp-hongyan-endpoint", customerRef: "cust-hongyan", title: "鸿雁汽车电子 全终端 IP-Guard 管控", stage: "qualified", amountEstimate: 3500000, ownerId: "user-1" },
  { ref: "opp-hongyan-mobile", customerRef: "cust-hongyan", title: "鸿雁汽车电子 移动设备安全接入", stage: "discovery", amountEstimate: 600000, ownerId: "user-1" },
];

export class MockCrmClient implements CrmClient {
  private readonly customers: Map<string, Customer>;
  private readonly opportunities: Map<string, Opportunity>;

  constructor(options: MockCrmClientOptions = {}) {
    this.customers = new Map(
      (options.customers ?? defaultMockCustomers).map((customer) => [customer.ref, customer]),
    );
    this.opportunities = new Map(
      (options.opportunities ?? defaultMockOpportunities).map((opportunity) => [
        opportunity.ref,
        opportunity,
      ]),
    );
  }

  async getCustomer(ref: string): Promise<Customer> {
    const customer = this.customers.get(ref);
    if (!customer) {
      throw new CrmClientError(`Unknown mock customer: ${ref}`, "mock", 404);
    }
    return customer;
  }

  async listCustomers(params: CrmListCustomersParams): Promise<Customer[]> {
    const query = (params.q ?? "").trim().toLowerCase();
    const filtered = [...this.customers.values()].filter((customer) => {
      if (params.ownerId && customer.ownerId !== params.ownerId) return false;
      if (query && !customer.name.toLowerCase().includes(query) && !customer.ref.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
    return filtered;
  }

  async getOpportunity(ref: string): Promise<Opportunity> {
    const opportunity = this.opportunities.get(ref);
    if (!opportunity) {
      throw new CrmClientError(`Unknown mock opportunity: ${ref}`, "mock", 404);
    }
    return opportunity;
  }

  async listOpportunities(params: CrmListOpportunitiesParams): Promise<Opportunity[]> {
    return [...this.opportunities.values()].filter((opportunity) => {
      if (params.customerRef && opportunity.customerRef !== params.customerRef) return false;
      if (params.stage && opportunity.stage !== params.stage) return false;
      return true;
    });
  }

  async upsertOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    this.opportunities.set(opportunity.ref, opportunity);
    return opportunity;
  }
}
