# QA first-token latency assessment

## Scope

This document evaluates the internal QA path implemented by `QaService`.
Issue #49 adds timing instrumentation and overlaps ACL lookup with
conversation/history preparation without changing retrieval or generation.

The user-visible first-token time is measured from submitting
`POST /api/internal/qa` until the first SSE `delta` event. The preceding
`session` event is protocol metadata and does not count as an answer token.

## Current measurements

Environment:

- Windows development host
- Node.js `v24.15.0`
- local RAGFlow Docker stack with real retrieval and reranking
- Bailian `qwen-max` through the OpenAI-compatible streaming endpoint
- internal presales user with ACL-filtered document IDs

The Issue #47 dispatch baseline records an 8.7-second first-token time against
the 2-second target. During the PR #46 real-link gate, the first query still
had no visible `delta` at the 8.7-second observation point and completed in
about 39 seconds. The next two queries completed in about 40 and 43 seconds.
This establishes that the current path misses the first-token target by at
least 4x; completion time is not a substitute for an instrumented TTFT value.

Issue #49 records server-side timestamps for:

1. request accepted / `session` emitted
2. conversation upsert and history load completed
3. ACL document IDs loaded
4. RAGFlow retrieval started
5. RAGFlow retrieval and rerank completed
6. LLM request started
7. first LLM delta received
8. stream completed

These spans are required to separate retrieval latency from Bailian queueing
and generation latency.

### Issue #47 clean-environment gate

The three single-run values recorded by Issue #47 are superseded by the
repeated Issue #49 measurement at the end of this document.

## Current critical path

`QaService.answer()` performs the following work before the first answer
`delta` can be emitted:

```text
conversation upsert
  -> history load
  -> ACL document lookup
  -> RAGFlow retrieval + rerank
  -> prompt construction
  -> Bailian request
  -> first LLM stream delta
```

The path is serial. In particular, the LLM request cannot start until the
complete retrieval response has been converted into the grounded prompt.
The browser SSE client renders each `delta` immediately and does not buffer
the answer, so the frontend is not the source of the measured delay.

## Candidate approaches

### 1. Overlap independent preparation work

Run ACL lookup in parallel with conversation/history preparation. Prompt
construction remains after retrieval.

Expected impact:

- low implementation risk
- removes only database-side overlap
- unlikely to reach the 2-second target by itself

Do not start speculative answer generation before retrieval finishes. A draft
generated without the final sources can contradict the grounded answer and
produce citation numbers that no longer match the final chunk list.

### 2. Cache hot retrieval results

Cache the final filtered RAGFlow chunks for repeated questions. A cache key
must include:

- `QA_KB_ID`
- normalized query
- retrieval and reranker configuration version
- an ACL visibility fingerprint derived from the allowed document IDs

Use a short TTL and invalidate on knowledge-base synchronization. Never share
cached chunks across different ACL fingerprints.

Expected impact:

- highest near-term gain for repeated gate and common presales questions
- preserves the current grounded prompt and citation flow
- cold queries still pay full RAGFlow latency
- requires cache hit-rate and stale-result monitoring

### 3. Streaming retrieval or staged generation

If RAGFlow exposes a retrieval stream, PAS could consume early chunks before
the full reranked result is available. The current LLM request cannot accept
new context after streaming starts, so this requires a staged protocol:

1. retrieve an initial stable source set
2. start generation against that set
3. either ignore later chunks or restart before exposing text

Expected impact:

- potential cold-query TTFT improvement
- high orchestration and correctness cost
- risks unstable source ordering and broken `[n]` citations
- depends on an upstream streaming retrieval contract that is not currently
  available in `RagflowClient`

## Recommendation

Issue #49 completes the first two steps of the original recommendation:

1. eight server-side timing spans and repeated p50/p95 measurements
2. ACL lookup overlapped with conversation/history preparation

The remaining order is:

1. add ACL-safe retrieval caching and measure cold versus warm TTFT
2. evaluate streaming retrieval only if cold p95 remains above target and
   RAGFlow provides a stable streaming contract

Acceptance should report user-visible first `delta` p50/p95 separately from
total completion time. Citation correctness and ACL isolation remain hard
constraints; latency work must not weaken either.

## Issue #49 measurement

### Method

Measurements ran on June 24, 2026 with:

- Windows development host and Node.js `v24.15.0`
- local RAGFlow Docker stack with real retrieval and reranking
- Bailian `qwen-max` through the OpenAI-compatible streaming endpoint
- `RAGFLOW_CLIENT_MODE=real` and `LLM_CLIENT_MODE=real`
- direct `RAGFLOW_BASE_URL=http://localhost:19380`
- the real 32-character dataset ID supplied through `QA_KB_ID`
- a clean git worktree and `NODE_OPTIONS` unset before each API start
- five repetitions per query, interleaved Q1/Q2/Q3, with a new session for
  every request
- nearest-rank p50/p95

The serial measurement used commit `2f0c67d`, after instrumentation but before
parallelization. The parallel measurement used commit `e578814`, after the ACL
and conversation/history overlap was implemented. Each phase contains 15
requests and 120 timing records.

### First delta

All values are seconds. Client TTFT is measured from starting the HTTP request
to receiving the first non-empty SSE `delta`. Server TTFT is span 7 elapsed
from span 1.

| Query | Samples/phase | Serial client p50 / p95 | Parallel client p50 / p95 | Serial server p50 / p95 | Parallel server p50 / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Q1: encryption policy and modes | 5 | 14.965 / 15.906 | 13.772 / 14.734 | 14.961 / 15.899 | 13.732 / 14.722 |
| Q2: WPS/default software library | 5 | 15.396 / 24.886 | 15.113 / 17.862 | 15.389 / 24.880 | 15.108 / 17.853 |
| Q3: Web console department policy | 5 | 13.429 / 16.342 | 13.616 / 18.980 | 13.424 / 16.331 | 13.604 / 18.959 |
| All queries | 15 | 14.438 / 24.886 | 14.686 / 18.980 | 14.431 / 24.880 | 14.679 / 18.959 |

Client and server TTFT remain closely aligned, so the browser/SSE client is not
buffering the first answer token. The all-query p95 reduction is not attributed
to the local parallelization because retrieval and LLM latency varied materially
between the two 15-sample runs.

### Stream completion

| Query | Samples/phase | Serial client p50 / p95 | Parallel client p50 / p95 |
| --- | ---: | ---: | ---: |
| Q1: encryption policy and modes | 5 | 33.679 / 50.329 | 34.018 / 40.820 |
| Q2: WPS/default software library | 5 | 28.006 / 56.686 | 22.779 / 48.456 |
| Q3: Web console department policy | 5 | 29.464 / 32.957 | 15.181 / 25.812 |

Completion time depends strongly on generated answer length and remains
separate from the first-token acceptance target.

### Server spans

Values are elapsed milliseconds from request acceptance. Each row aggregates
15 samples per phase.

| Span | Serial p50 / p95 | Parallel p50 / p95 |
| --- | ---: | ---: |
| `request_accepted_session_emitted` | 0.035 / 0.049 | 0.047 / 0.176 |
| `conversation_history_completed` | 35.676 / 184.153 | 50.588 / 127.275 |
| `acl_document_ids_loaded` | 44.760 / 192.866 | 17.651 / 161.415 |
| `ragflow_retrieval_started` | 44.956 / 193.133 | 51.008 / 163.114 |
| `ragflow_retrieval_completed` | 9747.324 / 19758.834 | 9985.804 / 15214.376 |
| `llm_request_started` | 9747.616 / 19759.157 | 9986.031 / 15214.716 |
| `first_llm_delta_received` | 14430.721 / 24879.792 | 14678.824 / 18959.367 |
| `stream_completed` | 30793.371 / 56680.801 | 25803.593 / 48449.643 |

The local preparation boundary is `ragflow_retrieval_started`. Its p95 improved
from 193.133 ms to 163.114 ms, a 30.019 ms reduction, while p50 increased by
6.052 ms. The repeated measurement therefore validates that the independent
work overlaps correctly but does not show a stable median TTFT improvement.
RAGFlow retrieval plus Bailian first-token latency remains the dominant path
and the overall p50 remains more than seven times the 2-second target.
