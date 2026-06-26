# PAS E2E Smoke Tests

`@pas/e2e` runs the E5 API-only smoke suite with `supertest`. It covers the three value lines from issue #20: internal QA SSE, proposal generation/export, and external-token security regression.

## Local Run

Start the dev dependencies first so Postgres and Redis are available on the expected ports:

```powershell
docker compose -f docker-compose.dev.yml up -d postgres redis
pnpm --filter api exec prisma migrate deploy
pnpm e2e
```

The e2e bootstrap sets its own mock env before starting the NestJS app:

- `IDP_MODE=mock`
- `CRM_PROVIDER=mock`
- `RAGFLOW_CLIENT_MODE=mock`
- `LLM_CLIENT_MODE=mock`
- `DATABASE_URL=postgresql://pas:pas@localhost:5544/pas`
- `REDIS_URL=redis://localhost:6399`

## Adding A Test

1. Add a focused spec under `apps/e2e/src/tests`.
2. Use `bootstrapE2e()` to start the API in process.
3. Use `loginWithMockIdp()` when the flow needs an internal user session.
4. Seed visible knowledge with `seedVisibleKnowledgeDocument()` when the flow expects RAGFlow mock chunks to pass ACL.
5. Run `pnpm e2e` locally before opening the PR.
