# PAS 生产排障 SOP

## 快速状态检查

```bash
cd /opt/pas
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 pas-api
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 pas-web
```

## 端口冲突

症状：`Bind for 0.0.0.0:<port> failed`。

处理：

```bash
ss -lntp
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

只改 `infra/.env.prod` 中的 `PAS_API_PORT`、`PAS_WEB_PORT`、`PAS_PG_PORT`、`PAS_REDIS_PORT`、`PAS_MINIO_PORT`、`PAS_MINIO_CONSOLE_PORT`，然后：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d
```

## Env schema 启动失败

症状：`pas-api` 退出，日志里出现 `ZodError` 或 env 名。

处理：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 pas-api
```

常见项：

- `DATABASE_URL`：必须是 `postgresql://pas:<password>@postgres:5432/pas`。
- `APP_BASE_URL`：必须是完整 URL，例如 `http://<vm-ip>:3001`。
- `JWT_SECRET`：长度至少 32。
- `PAS_KB_ID` / `QA_KB_ID`：必须填 RAGFlow dataset id。
- `IDP_MODE=mock cannot be used when NODE_ENV=production`：生产必须改为 `IDP_MODE=real`。

## 容器一直 unhealthy

API：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 pas-api
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec pas-api wget -qO- http://localhost:3001/api/health
```

Web：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 pas-web
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec pas-web wget -qO- http://localhost:3000/
```

Postgres / Redis / MinIO：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 postgres
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 redis
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 minio
```

## Worker 不消费 job

本期没有独立 `pas-worker` 容器；worker 在 `pas-api` 进程内启动。

检查：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs --tail=200 pas-api
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec pas-api node -e "console.log(process.env.REDIS_URL)"
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec redis redis-cli ping
```

确认 `REDIS_URL=redis://redis:6379`，且 `pas-api` 和 `pas-redis` 都在 `pas-net`。

## Migration 失败

先看状态：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml --profile migrate run --rm pas-api-migrator pnpm --filter api exec prisma migrate status
```

如果某个 migration 已人工确认落库但 Prisma 标记失败，按 Prisma 提示谨慎执行：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml --profile migrate run --rm pas-api-migrator pnpm --filter api exec prisma migrate resolve --applied <migration_name>
```

不要在未确认数据库状态时随意 `resolve`。

## 容器 OOM

症状：`pas-api` 被重启，`docker inspect pas-api` 里有 OOM 信息。

处理：

```bash
docker inspect pas-api --format '{{.State.OOMKilled}}'
docker stats pas-api
```

调大 `infra/.env.prod`：

```dotenv
PAS_API_MEM_LIMIT=2G
```

然后：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d pas-api
```

## 磁盘满

检查：

```bash
df -h
du -sh /var/backups/pas
du -sh /var/lib/docker/containers
docker system df
docker ps --format 'table {{.Names}}\t{{.Size}}'
docker volume ls | grep pas-prod
```

处理：

- 调低 `PAS_BACKUP_RETENTION_DAYS`。
- 清理旧的 `/var/backups/pas/pas-pg-*.dump.gz`。
- 检查 `pas-prod-minio-data` 是否异常增长。
- 检查容器日志是否异常增长；单容器日志通常在 `/var/lib/docker/containers/<id>/<id>-json.log`。
- 默认容器日志轮转为 `PAS_LOG_MAX_SIZE=50m`、`PAS_LOG_MAX_FILE=5`。如果 50m × 5 仍不够，在 `infra/.env.prod` 调整 `PAS_LOG_MAX_SIZE` / `PAS_LOG_MAX_FILE` 后执行 `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d` 重建容器生效；仅 `restart` 不会应用 logging 变更。
- 不要删除 `pas-prod-postgres-data`、`pas-prod-redis-data`、`pas-prod-minio-data`，除非已确认要销毁生产数据。

## RAGFlow 不通

检查 shared network：

```bash
docker network ls
docker inspect pas-api --format '{{json .NetworkSettings.Networks}}'
docker inspect <ragflow-container-name> --format '{{json .NetworkSettings.Networks}}'
```

确认 `SHARED_NETWORK_NAME` 与 RAGFlow 所在 network 一致，然后：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d pas-api
```
