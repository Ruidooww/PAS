# FastGPT 本地实验栈

该 Compose 仅用于 Issue #4 的 RAGFlow MCP 集成验证。它使用独立项目名 `pas-fastgpt-exp` 和命名卷，不复用 PAS 或 RAGFlow 的数据库、Redis、MinIO 和 network。

## 端口与边界

| 服务 | 宿主地址 | 说明 |
| --- | --- | --- |
| FastGPT Web | `http://127.0.0.1:3010` | 仅绑定 loopback |
| FastGPT MinIO API | `http://127.0.0.1:9920` | 仅绑定 loopback，不开放 console |

MongoDB、Redis、PostgreSQL 和 `fastgpt-plugin` 只在 Compose network 内可见。当前 FastGPT 版本启动时需要 plugin 提供模型 provider，因此该内部服务不能省略。实验栈不包含 Code Sandbox、AI Proxy、FastGPT MCP Server，也不导入 IP-Guard 文档。

## 首次启动

在仓库根目录执行：

```powershell
Copy-Item -LiteralPath infra/.env.fastgpt.example -Destination infra/.env.fastgpt
# 编辑 infra/.env.fastgpt，替换所有 replace-with-* 值和 LLM_API_KEY。

docker compose --env-file infra/.env.fastgpt -f infra/docker-compose.fastgpt.yml config --quiet
docker compose --env-file infra/.env.fastgpt -f infra/docker-compose.fastgpt.yml up -d
docker compose --env-file infra/.env.fastgpt -f infra/docker-compose.fastgpt.yml ps
```

FastGPT root 用户名固定为 `root`，密码只保存在未跟踪文件 `infra/.env.fastgpt` 的 `DEFAULT_ROOT_PSW` 中。

浏览器验证：

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3010 -UseBasicParsing
```

停止服务但保留数据卷：

```powershell
docker compose --env-file infra/.env.fastgpt -f infra/docker-compose.fastgpt.yml stop
```

## 接入现有 RAGFlow MCP

登录 FastGPT 后，在 MCP 工具集页面新增 Streamable HTTP 服务：

- URL：`http://host.docker.internal:19382/mcp`
- Headers：留空；当前 RAGFlow MCP 使用 self-host 服务账号模式
- 实际工具名：`ragflow_retrieval`

FastGPT 运行在容器内，因此不能把 MCP URL 写成 `localhost:19382`。Compose 已为 `host.docker.internal` 配置 host gateway。

本次 gate 参数使用 RAGFlow v0.26.1 的实际字段名：

```text
dataset_ids=["4bac62666ded11f1883e5d291d1e8e70"]
page_size=30
top_k=1024
similarity_threshold=0.1
vector_similarity_weight=0.3
rerank_id=gte-rerank-v2@bailian@Tongyi-Qianwen
```

Issue 原文中的 `list_datasets` / `retrieval` 和 `rerank_model` 与当前 RAGFlow MCP 契约不一致；实测偏离及临时验证补丁记录在实验报告中。
