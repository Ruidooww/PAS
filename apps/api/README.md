# PAS API

## QA knowledge base

Set `QA_KB_ID` to the RAGFlow dataset ID used by the QA routes:

```dotenv
QA_KB_ID=your_ragflow_dataset_id
```

When `QA_KB_ID` is omitted, the API keeps the mock-compatible default
`e0-mock-kb`. Real RAGFlow validation must set this variable to an existing
dataset ID; no request-time rewrite or local proxy is required.

## 本地造 admin 用户

`PrismaAuthUserStore` 的 mock 登录默认写入 `presales`，且再次登录不会覆盖 `role`。本地需要访问 admin 页面时，先登录一次并通过 `/api/me` 拿到 `uid`，再执行：

```sql
UPDATE users SET role = 'admin' WHERE id = '<刚登录后看 /api/me 拿到的 uid>';
```

执行后重新登录一次，让新的 session 带上 `admin` role。
