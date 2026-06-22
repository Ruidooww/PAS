# RAGFlow MCP + FastGPT 最小验证设计

## 目标与边界

本实验只验证 `RAGFlow MCP → FastGPT 工作流 → LLM 带引用回答`，为 E3 在 MCP 与 API KB 之间提供决策数据。它不修改 PAS 应用代码、不升级 RAGFlow、不迁移或复制 IP-Guard 知识库、不实现 `agentClient`，也不构建完整七章节 E3 工作流。

## 方案比较

1. **现有 RAGFlow 容器内启动 MCP + FastGPT 最小依赖栈（采用）**：复用 `v0.26.1` 镜像和已有 `19382:9382` 映射；FastGPT 只部署 App、MongoDB、Redis、pgvector、MinIO。优点是数据风险和资源占用最低，足够验证 MCP、工作流、引用及 LLM。
2. **修改 RAGFlow compose + 部署 FastGPT 官方完整栈**：MCP 重启后可自动恢复，且包含 Plugin、Code Sandbox、AIProxy、OpenSandbox。代价是需要修改外部 RAGFlow compose、启动约十个新服务并挂载 Docker socket，超出最小验证需要。
3. **FastGPT API KB 直连 RAGFlow**：引用 UI 更原生，但跳过 Issue 的 MCP 前置验证。仅作为实验结论中的备选路径，不实施。

## 运行架构

- RAGFlow 保持当前 `v0.26.1` 和所有数据卷不变。在 `ragflow-ragflow-cpu-1` 内启动官方 `/ragflow/mcp/server/server.py`，监听容器 `9382`，复用宿主 `19382`。
- MCP 使用 self-host 模式。PAS 服务账号 API key 仅从本机 ignored `ragflow-gate/apikey.txt` 读取并以进程环境变量传入，不写入仓库、compose 或命令行参数。
- FastGPT 采用 `v4.14.25`，Compose 项目名 `pas-fastgpt`。仅发布 `127.0.0.1:3010`（Web）和 `127.0.0.1:9920`（MinIO API），其余数据库只在独立内部网络可见。
- FastGPT 通过 `http://host.docker.internal:19382/mcp` 访问 RAGFlow。FastGPT 4.14.25 会优先尝试 Streamable HTTP，并支持 MCP header secret；本实验的 RAGFlow self-host endpoint 不要求 FastGPT 保存 API key。
- FastGPT 直接使用百炼 OpenAI-compatible endpoint，不部署 AIProxy。密钥只进入 ignored `.env.fastgpt`。

## 实际 MCP 契约偏差

RAGFlow `v0.26.1` 官方 server 只暴露 `ragflow_retrieval`。dataset 列表嵌入该工具 description，没有独立 `list_datasets`。检索参数使用 `dataset_ids` 和 `rerank_id`，完整 rerank ID 为 `gte-rerank-v2@bailian@Tongyi-Qianwen`。实验按实际契约执行，并在决策报告中评估这一偏差对 FastGPT 可读性和配置成本的影响。

## 工作流

最小工作流由四段组成：用户输入 → `ragflow_retrieval` MCP 节点（固化 dataset、rerank、page size）→ 模板节点将 chunks 规范为编号证据 → LLM 节点按“每个结论标 `[n]`，无依据则拒答”生成答案。工作流输出答案与引用列表，不写入 FastGPT 本地知识库。

## 证据与停止条件

- 机器可读证据保存为 `docs/experiments/assets/exp-001/retrieval-results.json`；截图保存到同目录。
- 三个 query 与 `ragflow-gate/gate_results_rerank.json` 的命中文档、证据覆盖和引用准确度进行对比。
- 若需要迁移 RAGFlow 数据、MCP 无法传递 `rerank_id`、FastGPT 无法连接内部 MCP、或工作流无法保证引用对齐，立即停止对应阶段并在 Issue #4 评论，保留负面结果。
