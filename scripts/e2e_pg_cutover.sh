#!/usr/bin/env bash
set -euo pipefail

# End-to-end PostgreSQL cutover verification:
# 1) create temp SQLite fixture DB
# 2) start temporary PostgreSQL container
# 3) init schema
# 4) migrate SQLite -> PostgreSQL
# 5) verify row-count parity
#
# Usage:
#   bash scripts/e2e_pg_cutover.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PG_CONTAINER_NAME="${PG_CONTAINER_NAME:-autochecker-pg-e2e}"
PG_PORT="${PG_PORT:-55432}"
PG_USER="${PG_USER:-autochecker}"
PG_PASS="${PG_PASS:-autochecker}"
PG_DB="${PG_DB:-autochecker}"
DEFAULT_TENANT_ID="${DEFAULT_TENANT_ID:-default}"
DB_PATH="${DB_PATH:-/tmp/autochecker-e2e-bot.db}"
DATABASE_URL="${DATABASE_URL:-postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:${PG_PORT}/${PG_DB}}"

echo "Preparing SQLite fixture: ${DB_PATH}"
rm -f "$DB_PATH"

BOT_TOKEN=test-token DB_PATH="$DB_PATH" DATABASE_URL="" DEFAULT_TENANT_ID="$DEFAULT_TENANT_ID" uv run python - <<'PY'
import asyncio
import importlib
import os

import bot.config as cfg
import bot.database as dbm

importlib.reload(cfg)
importlib.reload(dbm)

async def main():
    await dbm.init_db()
    await dbm.upsert_user(
        tg_id=1001,
        email="student@example.com",
        github_alias="student-gh",
        tg_username="student_tg",
        student_group="G1",
    )
    await dbm.set_server_ip(1001, "10.10.10.10")
    await dbm.set_vm_username(1001, "ubuntu")
    await dbm.set_lms_api_key(1001, "secret-key")
    await dbm.add_attempt(1001, "lab-01", "task-1")
    await dbm.add_attempt_grant(1001, "lab-01", "task-1", amount=2, reason="e2e")
    await dbm.save_result(
        tg_id=1001,
        lab_id="lab-01",
        task_id="task-1",
        score="100%",
        passed=1,
        failed=0,
        total=1,
        details='[{"id":"check-1","status":"PASS"}]',
    )
    await dbm.log_api_access("student@example.com", "/api/items")

asyncio.run(main())
print("SQLite fixture created.")
PY

echo "Starting PostgreSQL container ${PG_CONTAINER_NAME} on port ${PG_PORT}"
docker rm -f "${PG_CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d \
  --name "${PG_CONTAINER_NAME}" \
  -e POSTGRES_USER="${PG_USER}" \
  -e POSTGRES_PASSWORD="${PG_PASS}" \
  -e POSTGRES_DB="${PG_DB}" \
  -p "${PG_PORT}:5432" \
  postgres:16-alpine >/dev/null

cleanup() {
  docker rm -f "${PG_CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for PostgreSQL to become ready..."
for _ in {1..30}; do
  if docker exec "${PG_CONTAINER_NAME}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Running init_postgres.py"
DATABASE_URL="$DATABASE_URL" DEFAULT_TENANT_ID="$DEFAULT_TENANT_ID" uv run python scripts/init_postgres.py

echo "Running migrate_sqlite_to_postgres.py"
DB_PATH="$DB_PATH" DATABASE_URL="$DATABASE_URL" DEFAULT_TENANT_ID="$DEFAULT_TENANT_ID" uv run python scripts/migrate_sqlite_to_postgres.py

echo "Running verify_pg_migration.py"
DB_PATH="$DB_PATH" DATABASE_URL="$DATABASE_URL" DEFAULT_TENANT_ID="$DEFAULT_TENANT_ID" uv run python scripts/verify_pg_migration.py

echo "E2E PG cutover verification: PASS"
