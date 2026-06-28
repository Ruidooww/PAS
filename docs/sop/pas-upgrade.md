# PAS 升级与回滚 SOP

本期只做简单 stop/start 替换，不做蓝绿、灰度或多副本滚动。

## 升级

```bash
cd /opt/pas
git fetch --tags origin
git checkout <new-release-tag-or-commit>
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml build
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml run --rm pas-api pnpm --filter api exec prisma migrate deploy
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d pas-api pas-web
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
curl http://localhost:3001/api/health
```

## 回滚

```bash
cd /opt/pas
git checkout <previous-release-tag-or-commit>
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml build
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d pas-api pas-web
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
curl http://localhost:3001/api/health
```

如果新版本已经执行了不可逆 migration，不要直接回滚应用版本；先按变更说明确认数据库兼容性，必要时从 `backup-pg.sh` 产物恢复到新版本升级前的备份点。

## 升级前检查

- `docker compose ps` 当前 5 个容器为 `healthy`。
- `/var/backups/pas` 有当天或升级前手动备份。
- `infra/.env.prod` 没有未替换的 `<change_me>`、`<paste>`、`<vm-ip>`。
- RAGFlow / FastGPT 容器和 shared network 未被重建或改名。
