# Proposal generation worker

The API process hosts the BullMQ worker for queue `proposal-generation`. The
runtime is disabled when `NODE_ENV=test`; development and production use
`REDIS_URL`, with concurrency fixed at `2`.

## Local start

1. Start the existing Redis service on `localhost:6399`.
2. Set `REDIS_URL` and `PAS_KB_ID` in `.env`.
3. Apply the Prisma migrations.
4. Start the API:

```powershell
pnpm --filter api dev
```

The API and worker start together. There is no separate `apps/worker` process.

## Trigger and progress

Enqueue or replay generation for an existing proposal owned by the session
user:

```powershell
curl.exe -X POST "http://localhost:3001/api/internal/proposals/<proposal-id>/generate" `
  -H "Content-Type: application/json" `
  -H "Cookie: pas_session=<session-token>" `
  -d '{\"templateId\":\"ip-guard-standard-v1\"}'
```

Watch progress:

```powershell
curl.exe -N "http://localhost:3001/api/internal/proposals/<proposal-id>/progress" `
  -H "Accept: text/event-stream" `
  -H "Cookie: pas_session=<session-token>"
```

Replaying uses the same trigger endpoint and creates a new BullMQ job. The
worker overwrites `contentJson` only after all chapters have been attempted.

## Debugging

- Queue name: `proposal-generation`
- Progress channel: `proposal:<proposal-id>:progress`
- Chapter failures retry three times, publish `errorMessage`, and do not stop
  later chapters.
- Retrieval always receives the ACL document whitelist and filters returned
  chunks against it again.
- Run the focused tests and coverage gate:

```powershell
pnpm --filter api test:proposal-worker
pnpm --filter api test:proposal-worker:coverage
```
