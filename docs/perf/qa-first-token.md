# QA first-token latency assessment

## Scope

This document evaluates the internal QA path implemented by `QaService`.
Issue #47 does not change the orchestration or latency behavior.

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

The follow-up performance issue should add server-side timestamps for:

1. request accepted / `session` emitted
2. conversation and history loaded
3. ACL document IDs loaded
4. RAGFlow retrieval started and completed
5. LLM request started
6. first LLM delta received
7. stream completed

These spans are required to separate retrieval latency from Bailian queueing
and generation latency.

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

Open a dedicated performance issue with this order:

1. add the seven server-side timing spans and record p50/p95 over the three
   gate queries plus repeated warm queries
2. parallelize ACL lookup with conversation/history preparation
3. add ACL-safe retrieval caching and measure cold versus warm TTFT
4. evaluate streaming retrieval only if cold p95 remains above target and
   RAGFlow provides a stable streaming contract

Acceptance should report user-visible first `delta` p50/p95 separately from
total completion time. Citation correctness and ACL isolation remain hard
constraints; latency work must not weaken either.
