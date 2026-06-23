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
