# CI integration smoke

This smoke test verifies the fast CI integration path from issue #28:

- Docker Compose starts `postgres`, `redis`, `mock-ragflow`, and the `pas-api` runner image.
- Prisma migrations are deployed against the disposable Postgres container.
- The existing Prisma seed creates the mock tenant, user, and visible KB documents.
- The API logs in through the mock IdP and calls `POST /api/internal/qa`.
- The SSE response must include at least one `delta`, one `refs` event with a reference number `>= 1`, and a final `done`.

Run locally on Linux/macOS:

```bash
pnpm install --frozen-lockfile
pnpm smoke
```

On Windows, `docker` must be on `PATH`, or run with:

```powershell
$env:DOCKER_BIN = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
pnpm smoke
```

Useful diagnostics when it fails:

```bash
docker compose -f infra/docker-compose.ci.yml -p pas-ci-smoke ps
docker compose -f infra/docker-compose.ci.yml -p pas-ci-smoke logs --no-color
DATABASE_URL=postgresql://pas:pas@127.0.0.1:15444/pas pnpm --filter api exec prisma migrate status
docker compose -f infra/docker-compose.ci.yml -p pas-ci-smoke exec -T mock-ragflow \
  node -e "fetch('http://localhost:9380/datasets').then(r=>r.text()).then(console.log)"
docker compose -f infra/docker-compose.ci.yml -p pas-ci-smoke exec -T mock-ragflow \
  node -e "fetch('http://localhost:9380/retrieval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'smoke',dataset_ids:['e0-mock-kb'],document_ids:['mock-document']})}).then(r=>r.text()).then(console.log)"
```

The test writes compose logs to `apps/api/test-results/smoke/compose.log` on failure. The compose stack uses fixed localhost ports `13001`, `15444`, and `16379`.
