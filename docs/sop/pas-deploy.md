# PAS 生产部署 SOP

适用范围：公司 PVE Linux VM，PAS 与 RAGFlow / FastGPT compose 同机，内网 IP + 端口直访。不包含 HTTPS、域名、反代、蓝绿、Prometheus、异地备份或 secret vault。

## 1. 前置检查

- VM 已安装 Docker Engine、Docker Compose v2、Git、pnpm。
- RAGFlow / FastGPT 已运行，且 PAS 需要访问的 RAGFlow API 容器与 PAS 在同机 Docker 上。
- 准备 `/opt/pas` 作为部署目录，`infra/.env.prod` 权限设置为 `chmod 600`。

```bash
docker --version
docker compose version
docker ps
```

## 2. 确认 shared network

PAS 使用两个网络：

- `pas-net`：PAS 内部网络。
- `${SHARED_NETWORK_NAME}`：external network，用来让 `pas-api` 访问同机 RAGFlow / FastGPT。

在目标 VM 上先确认 RAGFlow 当前实际 network 名称：

```bash
docker network ls
docker inspect <ragflow-container-name> --format '{{json .NetworkSettings.Networks}}'
```

把确认后的 network name 写入 `infra/.env.prod`：

```dotenv
SHARED_NETWORK_NAME=ragflow
```

如果 network 不叫 `ragflow`，按机器实际值修改。

## 3. 端口表

| 服务 | 容器端口 | 默认宿主端口 | env 覆盖 |
| --- | ---: | ---: | --- |
| PAS Web | 3000 | 3000 | `PAS_WEB_PORT` |
| PAS API + worker | 3001 | 3001 | `PAS_API_PORT` |
| Postgres | 5432 | 5544 | `PAS_PG_PORT` |
| Redis | 6379 | 6399 | `PAS_REDIS_PORT` |
| MinIO API | 9000 | 9900 | `PAS_MINIO_PORT` |
| MinIO Console | 9001 | 9901 | `PAS_MINIO_CONSOLE_PORT` |

部署前检查 RAGFlow / FastGPT 已占用端口：

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -lntp
```

有冲突时只改 `infra/.env.prod` 里的 `PAS_*_PORT`，不要改 compose 文件。

## 4. 拉代码并准备 env

```bash
cd /opt
git clone https://github.com/Ruidooww/PAS.git pas
cd /opt/pas
git checkout <release-tag-or-commit>
cp infra/.env.prod.example infra/.env.prod
chmod 600 infra/.env.prod
```

填写 `infra/.env.prod`：

- 所有 `<change_me>`、`<paste>`、`<vm-ip>` 必须替换。
- `NODE_ENV=production` 时必须使用 `IDP_MODE=real`；现有 `apps/api/src/config/env.schema.ts` 会拒绝 `IDP_MODE=mock && NODE_ENV=production`。
- `APP_BASE_URL` 使用内网 API 地址，例如 `http://10.0.0.12:3001`。
- 当前 v1 默认内网 IP + HTTP，`APP_BASE_URL=http://<vm-ip>:3001` 时 session cookie 不带 `Secure` 是预期行为；如果未来切到 HTTPS / 反代 / 域名，必须同步改成 `https://...`，否则 session cookie 的 `Secure` flag 不会开启。
- `RAGFLOW_BASE_URL` 使用 shared network 上可达的 RAGFlow container/service 名。

常见启动期 env schema 报错：

| 报错片段 | 处理 |
| --- | --- |
| `DATABASE_URL` | 补齐 `DATABASE_URL=postgresql://pas:<password>@postgres:5432/pas` |
| `APP_BASE_URL` / `Invalid url` | 使用完整 URL，例如 `http://<vm-ip>:3001` |
| `JWT_SECRET` | 至少 32 个随机字符 |
| `PAS_KB_ID` / `QA_KB_ID` | 填 RAGFlow dataset id |
| `IDP_MODE=mock cannot be used when NODE_ENV=production` | 生产改为 `IDP_MODE=real`，或仅本地演练时临时使用非 production |

## 5. 构建镜像

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml build
```

本期只构建两个应用镜像：

- `pas-api`：HTTP API + BullMQ worker 同进程。
- `pas-web`：Next.js standalone server。

不要创建或启动独立 `pas-worker` 容器。

## 6. 启动数据层

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d postgres redis minio
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
```

等待 `postgres`、`redis`、`minio` 都为 `healthy`。

## 7. 执行 Prisma migration

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml run --rm pas-api pnpm --filter api exec prisma migrate deploy
```

## 8. 启动 API + Web

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
```

期望 5 个容器全为 `healthy`：

- `pas-postgres`
- `pas-redis`
- `pas-minio`
- `pas-api`
- `pas-web`

## 9. 基础验证

API health：

```bash
curl http://localhost:3001/api/health
```

浏览器访问：

```text
http://<vm-ip>:3000
```

验证 PAS 到 RAGFlow 的 container name 可达：

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec pas-api sh -lc 'wget -S --spider "$RAGFLOW_BASE_URL"'
```

如果 shell 没有加载 `RAGFLOW_BASE_URL`，直接替换成 `infra/.env.prod` 里的值。

## 10. 首次造 admin 用户

以下步骤与 `apps/api/README.md` 的“本地造 admin 用户”保持一致，不改 `user-store` 默认行为。

`PrismaAuthUserStore` 的 mock 登录默认写入 `presales`，且再次登录不会覆盖 `role`。本地需要访问 admin 页面时，先登录一次并通过 `/api/me` 拿到 `uid`，再执行：

```sql
UPDATE users SET role = 'admin' WHERE id = '<刚登录后看 /api/me 拿到的 uid>';
```

执行后重新登录一次，让新的 session 带上 `admin` role。

在容器里执行 SQL：

```bash
docker exec -it pas-postgres psql -U pas -d pas -c "UPDATE users SET role = 'admin' WHERE id = '<刚登录后看 /api/me 拿到的 uid>';"
```

生产正式上线如果使用飞书/企微真实 IdP，先用真实 IdP 登录一次拿 `/api/me` 里的 `uid`，再执行同一条 SQL。

## 11. 安装备份 crontab

先手动跑一次：

```bash
POSTGRES_USER=pas POSTGRES_DB=pas PAS_BACKUP_DIR=/var/backups/pas /opt/pas/infra/scripts/backup-pg.sh
ls -lh /var/backups/pas
```

crontab：

```cron
0 3 * * * POSTGRES_USER=pas POSTGRES_DB=pas PAS_BACKUP_DIR=/var/backups/pas /opt/pas/infra/scripts/backup-pg.sh >> /var/log/pas-backup.log 2>&1
```

## 12. 恢复演练

用一份备份在临时库上演练，不覆盖生产库：

```bash
docker exec pas-postgres createdb -U pas pas_restore_check
gunzip -c /var/backups/pas/<backup-file>.dump.gz | docker exec -i pas-postgres pg_restore -U pas -d pas_restore_check --clean --if-exists
docker exec pas-postgres psql -U pas -d pas_restore_check -c "\dt"
docker exec pas-postgres dropdb -U pas pas_restore_check
```

## 13. 重启持久化检查

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml down
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
```

重新登录后确认 admin 用户仍存在，Postgres / Redis / MinIO 数据未丢失。
