# @pas/clients/crm

CRM 客户端抽象 + 三个实现（External / Pas / Mock）。业务层只依赖 `CrmClient` 接口，
换 provider = 换 adapter。POJO options（无 NestJS 依赖），方便在 packages 间复用。

```ts
import {
  type CrmClient,
  ExternalCrmClient,
  MockCrmClient,
  PasCrmClient,
} from "@pas/clients/crm";

const client: CrmClient =
  provider === "mock"
    ? new MockCrmClient()
    : provider === "pas"
      ? new PasCrmClient()
      : new ExternalCrmClient({ baseUrl, apiKey });
```

`CrmClientError.status === 429` 表示触发上游限流，调用方应回退到缓存。
