#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

BACKUP_DIR="${PAS_BACKUP_DIR:-/var/backups/pas}"
RETENTION_DAYS="${PAS_BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/pas-pg-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"
docker exec pas-postgres pg_dump -U "$POSTGRES_USER" -F c "$POSTGRES_DB" > "$OUT"
gzip "$OUT"
find "$BACKUP_DIR" -name 'pas-pg-*.dump.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[ok] backup -> $OUT.gz"
