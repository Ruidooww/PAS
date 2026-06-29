# PAS RAGFlow Gate Harness

`@pas/gate` is a parameterized retrieval regression harness for RAGFlow tuning. It lives in `apps/gate/` so normal workspace commands can lint, typecheck, build, and test it. It does not use or modify the legacy root `ragflow-gate/` Python workspace.

## Setup

Create `apps/gate/.env` or export these environment variables before running the harness:

```powershell
$env:RAGFLOW_BASE_URL = "https://ragflow.example.com"
$env:RAGFLOW_API_KEY = "<replace_me>"
$env:PAS_GATE_KB_ID = "<replace_me>"
```

`PAS_GATE_KB_ID` is intentionally separate from `PAS_KB_ID` because gate tuning may target a different KB. `apps/gate/.env` is covered by the root `.gitignore` `.env.*` / `.env` rules.

## Fixtures

Queries live in `fixtures/queries.yml`.

Each query has:

- `id`: stable query identifier used in reports and diffs.
- `query`: the retrieval question.
- `expected_doc_names`: expected documents for recall calculations.
- `expected_pages_loose`: loose page hints for human review.
- `min_top_k_hit`: minimum expected hit count for the query.

The committed fixtures contain `<replace_me>` placeholders for ground truth. Replace those values before using this harness for real acceptance decisions.

Parameter groups live in `fixtures/params.yml`. Each group has:

- `name`: stable parameter group identifier.
- `rerank_model`: RAGFlow rerank model id; this maps to the retrieval payload `rerank_id`.
- `page_size`: RAGFlow retrieval page size.
- `top_k`: RAGFlow retrieval candidate count.
- `similarity_threshold`: RAGFlow retrieval similarity threshold.
- `vector_similarity_weight`: RAGFlow retrieval vector similarity weight.
- `eval_top_k`: local report cutoff for `Recall@5` style evaluation.

The `baseline` group copies the values from `apps/api/src/clients/ragflow.ts` `RETRIEVAL_DEFAULTS`; keep them in sync when production retrieval defaults change.

## Run

Run all parameter groups:

```powershell
pnpm gate:run --params all
```

Run one group:

```powershell
pnpm gate:run --params baseline
```

Each run writes:

- `apps/gate/results/<ISO timestamp>/results.json`
- `apps/gate/results/<ISO timestamp>/report.md`

The `results/` directory is gitignored.

## Diff

Compare two saved run ids:

```powershell
pnpm gate:diff 2026-06-29T01-00-00-000Z 2026-06-29T02-00-00-000Z
```

The diff report shows `recall_at_5`, hit document, and runtime deltas per parameter group and query.

## Add A Query

Append a new item to `fixtures/queries.yml`; no runner code changes are required.

Keep `id` stable once reports exist, because `gate:diff` uses `paramName::queryId` as the comparison key.

## Add A Parameter Group

Append a new item to `fixtures/params.yml` with the same fields as `baseline`. Use descriptive names such as `rerank-80` or `low-threshold-30`.

## Tests

```powershell
pnpm --filter @pas/gate test
```

The tests cover fixture loading and diff calculations only. They do not call a real RAGFlow instance.
