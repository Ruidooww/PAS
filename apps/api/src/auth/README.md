# PAS Auth / IdP

E1 当前实现 mock 优先路线：本地默认 `IDP_MODE=mock`，真实飞书 / 企业微信 adapter 已有可测试 scaffold，但真实 E2E 需要开发者后台凭据后再打开。

## Mock 登录

1. `.env` 使用：

```env
IDP_MODE=mock
JWT_SECRET=replace_with_at_least_32_random_characters
```

2. 浏览器访问：

```text
GET /auth/login?provider=mock
```

流程会跳到 `/auth/callback?provider=mock&code=mock-user-1`，写入 `pas_session` cookie，然后 `/api/me` 返回 mock 用户。

## 真实 IdP 切换

改 env，不改代码：

```env
IDP_MODE=real
FEISHU_APP_ID=...
FEISHU_APP_SECRET=...
FEISHU_REDIRECT_URI=http://localhost:3001/auth/callback?provider=feishu
WECOM_CORP_ID=...
WECOM_AGENT_ID=...
WECOM_APP_SECRET=...
WECOM_REDIRECT_URI=http://localhost:3001/auth/callback?provider=wecom
```

飞书凭据入口：飞书开放平台应用后台，配置网页应用 OAuth redirect URI。

企业微信凭据入口：企业微信管理后台 / 开发者中心，配置企业 ID、应用 AgentId、Secret、OAuth 授权回调域。

## 安全约束

- `JWT_SECRET` 启动期强校验，长度至少 32。
- `IDP_MODE=mock && NODE_ENV=production` 启动期直接失败。
- session cookie 名为 `pas_session`，属性：`HttpOnly; Secure; SameSite=Lax; Max-Age=604800`。
- 未带有效 cookie 访问受保护路由时返回 401。