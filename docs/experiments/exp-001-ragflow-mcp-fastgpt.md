# EXP-001: RAGFlow MCP + FastGPT 最小验证

Issue: #4  
结论日期: 2026-06-23

## 结论

E3 不建议把 FastGPT MCP workflow 作为核心方案生成链路。当前应走 PAS 后端直连 RAGFlow API/KB，FastGPT MCP 只保留为后续可选 UI/编排层 POC。

理由：

1. RAGFlow v0.26.1 的 MCP 契约与 Issue 预期不一致：实际工具是 `ragflow_retrieval`，不是 `list_datasets` + `retrieval`；rerank 参数是 `rerank_id`，且需要完整模型 ID。
2. RAGFlow MCP server 在 v0.26.1 下存在 `page_size=1000` 与 RAGFlow API `page_size<=100` 的兼容问题，实验中需要临时 runtime patch 才能完成工具发现和 dataset resolve。
3. RAGFlow MCP 单独检索链路可用，能返回 gate query 的非空 chunks；但 FastGPT workflow preview 在 `chatTest` 阶段无法进入 MCP/LLM 节点执行，停在 `加载中...` 直到长超时。
4. FastGPT 增加了 app/current version/auto-save version 三份状态、workflow graph schema、UI preview body 等额外不确定性；对 E3 来说没有带来必要收益。
5. PAS 直连 RAGFlow API 更符合 D2 “能力供应商而非后端”纪律，便于参数透传、引用审计、自动化测试和权限控制。

## 环境

| 项 | 值 |
| --- | --- |
| RAGFlow image | `infiniflow/ragflow:v0.26.1` |
| RAGFlow MCP endpoint | `http://127.0.0.1:19382/mcp` |
| RAGFlow MCP mode | `self-host`, Streamable HTTP |
| PAS IP-Guard KB id | `4bac62666ded11f1883e5d291d1e8e70` |
| FastGPT image | `ghcr.io/labring/fastgpt:v4.14.25` |
| FastGPT UI observed version | `V4.14.20` |
| FastGPT Web | `http://127.0.0.1:3010` |
| FastGPT Compose project | `pas-fastgpt-exp` |

没有升级 RAGFlow，没有迁移 KB，没有把 IP-Guard 文档导入 FastGPT 本地 KB。

## RAGFlow MCP smoke

RAGFlow MCP server 启动后，Inspector / MCP client 能看到实际工具：

- `ragflow_retrieval`
- 工具 description 内嵌 dataset 列表，其中包含 PAS IP-Guard KB: `4bac62666ded11f1883e5d291d1e8e70`

截图：

- [Inspector tools](assets/exp-001/01-inspector-tools.png)
- [Inspector retrieval](assets/exp-001/02-inspector-retrieval.png)

参数使用 v0.26.1 实际契约：

```text
dataset_ids=["4bac62666ded11f1883e5d291d1e8e70"]
page_size=30
top_k=1024
similarity_threshold=0.1
vector_similarity_weight=0.3
rerank_id=gte-rerank-v2@bailian@Tongyi-Qianwen
```

结果保存于 [retrieval-results.json](assets/exp-001/retrieval-results.json)。

### Gate query top-3

| Query | Top-3 命中摘要 |
| --- | --- |
| 控制台加密策略怎么设置 | `IP-guardV4用户手册（4.86.1941）.pdf` p529；`IP-guardV4用户手册(4.87.2226.0).pdf`；`Web控制台使用说明20251031.pdf` p38 |
| WPS 是不是 IP-Guard 默认授权软件库的一部分 | `V4授权库管理工具(SafeSoftLibMgrV4)使用说明.pdf` p9；`IP-guardV4用户手册(4.87.2226.0).pdf`；`IP-guard 产品白皮书_2023.11.30.pdf` p23 |
| 如何在 UI 上配置某个加密策略 | `IP-guardV4用户手册(4.87.2226.0).pdf`；`Web控制台使用说明20251031.pdf` p21；`IP-guardV4用户手册（4.86.1941）.pdf` p62 |

判读：

- Q1 命中强，能定位到加密策略设置章节。
- Q2 命中弱但非空，默认授权软件库/WPS 需要后续更精确资料或更强查询改写。
- Q3 命中弱且分散，Web 控制台窄操作题仍是检索短板。

## FastGPT MCP tool 接入

FastGPT 首次部署已完成，MCP tool set 使用：

```text
URL=http://host.docker.internal:19382/mcp
tool=ragflow_retrieval
```

FastGPT 能解析并展示 `ragflow_retrieval`，包含 dataset id 与工具 schema。

截图：

- [FastGPT MCP tools](assets/exp-001/03-fastgpt-mcp-tools.png)

FastGPT tool debug 曾复现并修复一个 RAGFlow MCP runtime 问题：

- `resolve_dataset_ids` 内部使用 `_DATASET_PAGE_SIZE=1000`
- 当前 RAGFlow `/datasets` API 限制 `page_size<=100`
- 临时 patch 为 `_DATASET_PAGE_SIZE=100` 后，FastGPT tool debug 可返回 RAGFlow chunks

该 patch 仅存在于运行中容器 `/tmp/ragflow-mcp-server.py`，未修改镜像、未迁移 KB。

## FastGPT workflow preview 结果

按 Issue Step 5 创建了最小 workflow 目标结构：

```text
workflowStart -> ragflow_retrieval -> textEditor -> AI chat
```

其中：

- `ragflow_retrieval.question` 绑定 `workflowStart.userChatInput`
- `dataset_ids` 固定为 PAS KB id
- `rerank_id` 固定为 `gte-rerank-v2@bailian@Tongyi-Qianwen`
- `textEditor` 将用户问题与 `ragflow_retrieval.system_rawResponse` 拼接
- `AI chat` 使用 `qwen-max`，要求基于检索片段回答并标注 `[n]`

实际阻塞：

1. UI 保存/发布后，FastGPT app 当前文档一度被覆盖为 `edges: []`，且 text template 节点缺失。
2. 本地实验修正 app graph 后，发现 `app_versions` 最新快照仍保留旧 graph；FastGPT preview 会读取 version 快照。
3. 同步 app graph 到 `app_versions` 后，UI 仍在 `/api/core/chat/chatTest` 阶段停留 `加载中...`。
4. FastGPT Mongo / logs 证据显示：
   - `chatTest` 已启动并创建 Human/AI chat items。
   - `chat_item_responses` 为空。
   - `llm_request_records` 为空。
   - RAGFlow MCP `/mcp` 无新增调用。

因此失败发生在 FastGPT workflow preview dispatch 进入节点执行之前，不是 RAGFlow 检索质量问题，也不是 LLM 生成慢。

该 blocker 已按 Issue 要求记录到 Issue 评论中；未继续做容器内热补丁、未重启服务、未改端口。

## 与 PAS 直连 RAGFlow 对比

| 维度 | FastGPT MCP workflow | PAS 直连 RAGFlow API/KB |
| --- | --- | --- |
| 检索参数透传 | 可在 tool schema 中配置，但受 MCP 契约差异和 FastGPT 节点输入状态影响 | 后端可显式控制 `dataset_ids`、`page_size`、`rerank_id`、阈值 |
| 引用可审计性 | 需要 text/code 节点把 raw chunks 转为引用格式，workflow 未跑通 | 可直接把 RAGFlow chunk id/doc/page 映射成 PAS 引用 |
| 稳定性 | 当前 preview dispatch 未进入 MCP/LLM，且 version 快照状态复杂 | RAGFlow MCP/API baseline 已返回稳定非空 chunks |
| 上手成本 | 需要 FastGPT、plugin、Mongo、Redis、PG、MinIO 与 UI workflow 配置 | 只需 PAS `ragflowClient` 封装与自动化测试 |
| D2 适配 | FastGPT 容易变成第二后端/状态源 | RAGFlow 保持能力供应商，PAS 保持权限/审计/业务后端 |

## 决策建议

E3 当前走 PAS 直连 RAGFlow API/KB。

FastGPT MCP 可以后续作为独立 Issue 重测，但至少应等以下条件满足：

- RAGFlow MCP server 修复 `page_size` 默认值与 dataset resolve 问题。
- FastGPT workflow preview 能稳定从当前 graph/version 进入节点执行。
- FastGPT 能稳定透传 `rerank_id`、`page_size`、`dataset_ids` 并暴露可审计 raw chunks。
- 三个 gate query 能产出带引用答案，而不是只在工具 debug 层返回 chunks。

