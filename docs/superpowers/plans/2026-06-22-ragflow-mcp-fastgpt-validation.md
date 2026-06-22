# RAGFlow MCP + FastGPT Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate RAGFlow MCP retrieval inside a minimal FastGPT workflow and produce an evidence-backed E3 MCP-versus-API-KB decision.

**Architecture:** Start the MCP process inside the existing RAGFlow v0.26.1 container without changing its image, ports, or data. Deploy an isolated five-service FastGPT 4.14.25 stack, connect it to RAGFlow over Streamable HTTP, and test the same three gate queries through a citation-rendering workflow.

**Tech Stack:** RAGFlow MCP, MCP Inspector, FastGPT 4.14.25, Docker Compose, MongoDB 5.0, Redis 7.2, pgvector/PostgreSQL 15, MinIO, Bailian OpenAI-compatible API

---

### Task 1: Confirm and start the RAGFlow MCP server

**Files:**
- Read only: `C:/Users/Ruidoww/Documents/HYYA/AI/PAS/ragflow-gate/apikey.txt`
- Read only: `C:/Users/Ruidoww/Documents/HYYA/AI/PAS/ragflow-gate/dataset_id.txt`

- [ ] **Step 1: Confirm the running RAGFlow version and MCP source**

Run Docker inspection for `ragflow-ragflow-cpu-1` and confirm image `v0.26.1`, `/ragflow/mcp/server/server.py`, and existing host mapping `19382:9382`.

- [ ] **Step 2: Confirm the pre-change Issue comment exists**

Run: `gh issue view 4 --repo Ruidooww/PAS --comments`

Expected: comment documents no image upgrade, no KB migration, MCP startup command class, FastGPT ports, and the actual tool/parameter names.

- [ ] **Step 3: Start MCP idempotently without exposing the API key**

Read the key into a PowerShell variable, pass it through `docker exec -e RAGFLOW_MCP_HOST_API_KEY`, and run:

```text
uv run mcp/server/server.py --host=0.0.0.0 --port=9382 --base-url=http://127.0.0.1:9380 --mode=self-host
```

Expected: `/tmp/ragflow-mcp.log` reports Streamable HTTP `/mcp` and SSE `/sse`; the existing RAGFlow application remains available.

- [ ] **Step 4: Verify no RAGFlow data or compose metadata changed**

Compare container image, mounts, volumes, and knowledge dataset ID before and after startup. Do not run any migration or recreate the RAGFlow compose project.

### Task 2: Run MCP Inspector smoke and gate retrievals

**Files:**
- Create: `docs/experiments/assets/exp-001/retrieval-results.json`
- Create: `docs/experiments/assets/exp-001/01-inspector-tools.png`
- Create: `docs/experiments/assets/exp-001/02-inspector-retrieval.png`

- [ ] **Step 1: List tools through Inspector CLI**

Run:

```powershell
npx -y @modelcontextprotocol/inspector --cli http://localhost:19382/mcp --transport http --method tools/list
```

Expected: one tool named `ragflow_retrieval`; its description contains the PAS dataset ID and its schema contains `rerank_id` and `page_size`.

- [ ] **Step 2: Call all three gate queries**

For each query call `ragflow_retrieval` with:

```json
{
  "dataset_ids": ["4bac62666ded11f1883e5d291d1e8e70"],
  "question": "控制台加密策略怎么设置",
  "page_size": 30,
  "top_k": 1024,
  "similarity_threshold": 0.1,
  "vector_similarity_weight": 0.3,
  "rerank_id": "gte-rerank-v2@bailian@Tongyi-Qianwen"
}
```

Repeat the call by changing only `question` to the exact Q2 and Q3 strings below.

Queries, in order:

1. `控制台加密策略怎么设置`
2. `WPS 是不是 IP-Guard 默认授权软件库的一部分`
3. `在 Web 控制台中，如何给某个部门新建并下发一条文档加密策略？`

Expected: non-empty chunks. Record the top three `document_name`, page information, similarity, chunk ID, and bounded text excerpt in UTF-8 JSON.

- [ ] **Step 3: Start Inspector UI on safe local-only ports**

Run with `CLIENT_PORT=6400`, `SERVER_PORT=6401`, `MCP_AUTO_OPEN_ENABLED=false`. Connect to `http://localhost:19382/mcp` as Streamable HTTP and save tools/retrieval screenshots. Keep proxy authentication enabled.

- [ ] **Step 4: Commit Task 1–2 evidence**

Commit message: `test: validate RAGFlow MCP retrieval contract`

### Task 3: Add and deploy the isolated FastGPT stack

**Files:**
- Create: `infra/docker-compose.fastgpt.yml`
- Create: `infra/.env.fastgpt.example`
- Create: `infra/fastgpt-config.json`
- Create: `infra/README-fastgpt.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add the ignored secret file contract**

Ignore `infra/.env.fastgpt`; provide example keys for root credentials, MongoDB, Redis, MinIO, Bailian endpoint/API key, and published ports without real secrets.

- [ ] **Step 2: Define the five-service compose project**

Use project name `pas-fastgpt` and images: FastGPT `v4.14.25`, MongoDB `5.0.32`, Redis `7.2-alpine`, pgvector `0.8.0-pg15`, MinIO `RELEASE.2025-09-07T16-13-09Z`. Publish only `127.0.0.1:3010:3000` and `127.0.0.1:9920:9000`; add health checks, independent named volumes, and an internal network.

- [ ] **Step 3: Validate compose without starting it**

Run: `docker compose --env-file infra/.env.fastgpt -f infra/docker-compose.fastgpt.yml config --quiet`

Expected: exit 0; no secret values appear in tracked files.

- [ ] **Step 4: Start FastGPT after the existing Issue comment gate**

Run: `docker compose --env-file infra/.env.fastgpt -f infra/docker-compose.fastgpt.yml up -d`

Expected: all five containers healthy/running; no PAS or RAGFlow container is recreated.

- [ ] **Step 5: Verify Web and document local startup**

Open `http://localhost:3010`, log in as `root` using the password stored in `infra/.env.fastgpt`, and document restart/health/log commands in `infra/README-fastgpt.md`.

- [ ] **Step 6: Commit infrastructure**

Commit message: `feat: add isolated FastGPT validation stack`

### Task 4: Connect FastGPT to RAGFlow MCP

**Files:**
- Create: `docs/experiments/assets/exp-001/03-fastgpt-mcp-tools.png`
- Modify: `infra/README-fastgpt.md`

- [ ] **Step 1: Configure the Bailian model provider**

Use FastGPT's root model-provider UI with `FASTGPT_LLM_BASE_URL` and `FASTGPT_LLM_API_KEY` from the ignored env file. Enable `qwen-max` as the language model; do not paste credentials into tracked files or screenshots.

- [ ] **Step 2: Create the MCP toolset**

Create an MCP toolset with URL `http://host.docker.internal:19382/mcp`, parse tools, and confirm `ragflow_retrieval` is visible with `rerank_id` and `page_size` inputs.

- [ ] **Step 3: Save evidence and reproducible UI steps**

Capture the tool list without secrets and add exact menu steps to `infra/README-fastgpt.md`.

### Task 5: Build and execute the minimal citation workflow

**Files:**
- Create: `docs/experiments/assets/exp-001/04-fastgpt-q1.png`
- Create: `docs/experiments/assets/exp-001/05-fastgpt-q2.png`
- Create: `docs/experiments/assets/exp-001/06-fastgpt-q3.png`

- [ ] **Step 1: Create the workflow nodes in order**

Create user input → MCP `ragflow_retrieval` → template → LLM → output. Fix dataset ID, `page_size=30`, `top_k=1024`, `similarity_threshold=0.1`, `vector_similarity_weight=0.3`, and the full `rerank_id` in the MCP node.

- [ ] **Step 2: Apply the citation prompt**

Template evidence as numbered chunks and instruct `qwen-max`: `仅基于检索内容回答；每个产品能力或操作结论必须标 [n]；无明确依据时写“资料不足”，不要猜测。`

- [ ] **Step 3: Run Q1, Q2, and Q3 sequentially**

For each query verify the answer is non-empty, every citation number resolves to one returned chunk, and no FastGPT local knowledge base is selected or populated. Save one screenshot per query with input, output, and citations visible.

- [ ] **Step 4: Report blockers immediately**

If `rerank_id` cannot be fixed/passed, MCP output cannot reach the template node, or citation numbering cannot be preserved, stop workflow iteration and comment on Issue #4 before selecting a workaround.

### Task 6: Compare results and publish the decision

**Files:**
- Create: `docs/experiments/exp-001-ragflow-mcp-fastgpt.md`
- Modify: `infra/README-fastgpt.md`

- [ ] **Step 1: Compare against the E2 baseline**

Read `ragflow-gate/gate_results_rerank.json` and compare each query on top-three evidence, answer coverage, citation correctness, workflow readability, and setup cost.

- [ ] **Step 2: Write the decision report**

Record RAGFlow/FastGPT versions, dataset ID, actual MCP contract, Inspector evidence, workflow evidence, per-query results, limitations, and a single E3 recommendation. Limit recommendation reasons to five.

- [ ] **Step 3: Verify scope and secrets**

Run compose config, repository tests, `git diff --check`, a secret-pattern scan, and `git status`. Confirm no PAS source file, RAGFlow data, or FastGPT local KB was changed.

- [ ] **Step 4: Commit report and documentation**

Commit message: `docs: record MCP versus API KB decision`

- [ ] **Step 5: Push and open the draft PR**

Open a PR to `main` with body first line `Closes #4`, list all Docker/port actions, include verification evidence and known deviations, and wait for GitHub Actions.
