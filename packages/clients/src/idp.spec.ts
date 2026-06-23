import { describe, expect, it, vi } from "vitest";

import {
  FeishuIdpClient,
  MockIdpClient,
  WecomIdpClient,
  type UserProfile,
} from "./index";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("MockIdpClient", () => {
  it("builds a local callback URL and returns the selected mock user profile", async () => {
    const users: UserProfile[] = [
      {
        idpUserId: "mock-user-1",
        name: "Mock 售前",
        email: "mock.presales@example.com",
        avatar: "https://example.com/avatar.png",
        deptIds: ["dept-presales"],
      },
      {
        idpUserId: "mock-user-2",
        name: "Mock 实施",
        email: "mock.impl@example.com",
        deptIds: ["dept-impl"],
      },
    ];
    const client = new MockIdpClient({ users, selectedUserId: "mock-user-2" });

    const authUrl = client.getAuthUrl({
      state: "state-123",
      redirectUri: "http://localhost:3001/auth/callback?provider=mock",
    });
    expect(authUrl).toBe(
      "http://localhost:3001/auth/callback?provider=mock&code=mock-user-2&state=state-123",
    );

    await expect(client.exchangeCode({ code: "mock-user-2" })).resolves.toMatchObject({
      accessToken: "mock:mock-user-2",
      openId: "mock-user-2",
    });
    await expect(client.getUserInfo({ accessToken: "mock:mock-user-2" })).resolves.toEqual(
      users[1],
    );
  });
});

describe("FeishuIdpClient", () => {
  it("implements the Feishu OAuth code exchange and userinfo requests with fetch injection", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          data: { access_token: "feishu-user-token", open_id: "ou_mock" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          data: {
            open_id: "ou_mock",
            name: "飞书用户",
            email: "feishu@example.com",
            avatar_url: "https://avatar.example.com/f.png",
            department_ids: ["od-1"],
          },
        }),
      );
    const client = new FeishuIdpClient({
      appId: "cli_a",
      appSecret: "secret",
      fetchImpl,
    });

    const authUrl = new URL(
      client.getAuthUrl({
        state: "state",
        redirectUri: "http://localhost:3001/auth/callback?provider=feishu",
      }),
    );
    expect(authUrl.origin + authUrl.pathname).toBe(
      "https://accounts.feishu.cn/open-apis/authen/v1/index",
    );
    expect(authUrl.searchParams.get("app_id")).toBe("cli_a");
    expect(authUrl.searchParams.get("state")).toBe("state");

    const token = await client.exchangeCode({ code: "code-1" });
    expect(token).toMatchObject({ accessToken: "feishu-user-token", openId: "ou_mock" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: "cli_a",
          client_secret: "secret",
          code: "code-1",
        }),
      }),
    );

    await expect(client.getUserInfo({ accessToken: token.accessToken })).resolves.toEqual({
      idpUserId: "ou_mock",
      name: "飞书用户",
      email: "feishu@example.com",
      avatar: "https://avatar.example.com/f.png",
      deptIds: ["od-1"],
    });
  });
});

describe("WecomIdpClient", () => {
  it("implements the WeCom OAuth getuserinfo + getuserdetail flow with fetch injection", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ errcode: 0, access_token: "corp-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ errcode: 0, UserId: "zhangsan", user_ticket: "ticket-1" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          userid: "zhangsan",
          name: "企微用户",
          email: "wecom@example.com",
          avatar: "https://avatar.example.com/w.png",
          department: [10, 20],
        }),
      );
    const client = new WecomIdpClient({
      corpId: "ww123",
      agentId: "1000002",
      appSecret: "secret",
      fetchImpl,
    });

    const authUrl = client.getAuthUrl({
      state: "state",
      redirectUri: "http://localhost:3001/auth/callback?provider=wecom",
    });
    expect(authUrl).toContain("https://open.weixin.qq.com/connect/oauth2/authorize");
    expect(authUrl).toContain("appid=ww123");
    expect(authUrl).toContain("agentid=1000002");
    expect(authUrl).toContain("#wechat_redirect");

    const token = await client.exchangeCode({ code: "code-1" });
    expect(token).toMatchObject({ accessToken: "ticket-1", openId: "zhangsan" });

    await expect(client.getUserInfo({ accessToken: token.accessToken })).resolves.toEqual({
      idpUserId: "zhangsan",
      name: "企微用户",
      email: "wecom@example.com",
      avatar: "https://avatar.example.com/w.png",
      deptIds: ["10", "20"],
    });
  });
});

describe("real IdP integration tests", () => {
  it.skip("需真实 dev 凭据：Feishu OAuth callback integration", () => undefined);
  it.skip("需真实 dev 凭据：WeCom OAuth callback integration", () => undefined);
});
