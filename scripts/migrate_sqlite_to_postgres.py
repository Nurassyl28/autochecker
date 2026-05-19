"""Migrate runtime data from SQLite to PostgreSQL.

Usage:
  export DB_PATH=bot.db
  export DATABASE_URL='postgresql://user:pass@localhost:5432/autochecker'
  export DEFAULT_TENANT_ID='default'
  uv run python scripts/init_postgres.py
  uv run python scripts/migrate_sqlite_to_postgres.py
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

import psycopg


ROOT = Path(__file__).resolve().parent.parent


def _safe_json_array(value: Any) -> str:
    """Return JSON array string for results.details."""
    if not value:
        return "[]"
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            pass
    return "[]"


def _table_exists(cur: sqlite3.Cursor, table: str) -> bool:
    cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
        (table,),
    )
    return cur.fetchone() is not None


def main() -> None:
    db_path = (os.getenv("DB_PATH") or str(ROOT / "bot.db")).strip()
    dsn = (os.getenv("DATABASE_URL") or "").strip()
    tenant_id = (os.getenv("DEFAULT_TENANT_ID") or "default").strip() or "default"
    tenant_name = (os.getenv("DEFAULT_TENANT_NAME") or "Default University").strip()

    if not dsn:
        raise SystemExit("DATABASE_URL is empty.")
    if not Path(db_path).exists():
        raise SystemExit(f"SQLite DB does not exist: {db_path}")

    src = sqlite3.connect(db_path)
    src.row_factory = sqlite3.Row
    s_cur = src.cursor()

    with psycopg.connect(dsn, autocommit=True) as pg:
        with pg.cursor() as cur:
            cur.execute(
                """
                INSERT INTO universities (id, name)
                VALUES (%s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (tenant_id, tenant_name),
            )

            if _table_exists(s_cur, "users"):
                s_cur.execute(
                    """
                    SELECT tg_id, email, github_alias, tg_username, is_admin,
                           COALESCE(server_ip, '') AS server_ip,
                           COALESCE(student_group, '') AS student_group,
                           COALESCE(lms_api_key, '') AS lms_api_key,
                           COALESCE(vm_username, '') AS vm_username,
                           COALESCE(registered_at, CURRENT_TIMESTAMP) AS registered_at,
                           COALESCE(tenant_id, ?) AS tenant_id,
                           COALESCE(role, 'student') AS role
                    FROM users
                    """,
                    (tenant_id,),
                )
                users = s_cur.fetchall()
                for r in users:
                    cur.execute(
                        """
                        INSERT INTO users (
                            tg_id, tenant_id, role, email, github_alias, tg_username, is_admin,
                            server_ip, student_group, lms_api_key, vm_username, registered_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::timestamptz)
                        ON CONFLICT (tg_id) DO UPDATE SET
                            tenant_id = EXCLUDED.tenant_id,
                            role = EXCLUDED.role,
                            email = EXCLUDED.email,
                            github_alias = EXCLUDED.github_alias,
                            tg_username = EXCLUDED.tg_username,
                            is_admin = EXCLUDED.is_admin,
                            server_ip = EXCLUDED.server_ip,
                            student_group = EXCLUDED.student_group,
                            lms_api_key = EXCLUDED.lms_api_key,
                            vm_username = EXCLUDED.vm_username
                        """,
                        (
                            r["tg_id"], r["tenant_id"], r["role"], r["email"], r["github_alias"], r["tg_username"],
                            bool(r["is_admin"]), r["server_ip"], r["student_group"], r["lms_api_key"],
                            r["vm_username"], str(r["registered_at"]),
                        ),
                    )
                print(f"users migrated: {len(users)}")

            if _table_exists(s_cur, "attempts"):
                s_cur.execute(
                    """
                    SELECT tg_id, lab_id, COALESCE(task_id, '') AS task_id,
                           COALESCE(timestamp, CURRENT_TIMESTAMP) AS timestamp,
                           COALESCE(tenant_id, ?) AS tenant_id
                    FROM attempts
                    """,
                    (tenant_id,),
                )
                rows = s_cur.fetchall()
                for r in rows:
                    cur.execute(
                        """
                        INSERT INTO attempts (tenant_id, tg_id, lab_id, task_id, timestamp)
                        VALUES (%s, %s, %s, %s, %s::timestamptz)
                        """,
                        (r["tenant_id"], r["tg_id"], r["lab_id"], r["task_id"], str(r["timestamp"])),
                    )
                print(f"attempts migrated: {len(rows)}")

            if _table_exists(s_cur, "attempt_grants"):
                s_cur.execute(
                    """
                    SELECT tg_id, lab_id, COALESCE(task_id, '') AS task_id,
                           COALESCE(amount, 0) AS amount,
                           COALESCE(reason, '') AS reason,
                           COALESCE(timestamp, CURRENT_TIMESTAMP) AS timestamp,
                           COALESCE(tenant_id, ?) AS tenant_id
                    FROM attempt_grants
                    """,
                    (tenant_id,),
                )
                rows = s_cur.fetchall()
                for r in rows:
                    cur.execute(
                        """
                        INSERT INTO attempt_grants (tenant_id, tg_id, lab_id, task_id, amount, reason, timestamp)
                        VALUES (%s, %s, %s, %s, %s, %s, %s::timestamptz)
                        """,
                        (r["tenant_id"], r["tg_id"], r["lab_id"], r["task_id"], int(r["amount"]), r["reason"], str(r["timestamp"])),
                    )
                print(f"attempt_grants migrated: {len(rows)}")

            if _table_exists(s_cur, "results"):
                s_cur.execute(
                    """
                    SELECT tg_id, lab_id, task_id, score, passed, failed, total,
                           COALESCE(details, '') AS details,
                           COALESCE(timestamp, CURRENT_TIMESTAMP) AS timestamp,
                           COALESCE(tenant_id, ?) AS tenant_id
                    FROM results
                    """,
                    (tenant_id,),
                )
                rows = s_cur.fetchall()
                for r in rows:
                    cur.execute(
                        """
                        INSERT INTO results (
                            tenant_id, tg_id, lab_id, task_id, score, passed, failed, total, details, timestamp
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::timestamptz)
                        """,
                        (
                            r["tenant_id"], r["tg_id"], r["lab_id"], r["task_id"], r["score"],
                            r["passed"], r["failed"], r["total"], _safe_json_array(r["details"]), str(r["timestamp"]),
                        ),
                    )
                print(f"results migrated: {len(rows)}")

            if _table_exists(s_cur, "api_access_log"):
                # Older SQLite DBs may not have tenant_id in api_access_log.
                if _table_exists(s_cur, "api_access_log"):
                    s_cur.execute("PRAGMA table_info(api_access_log)")
                    cols = {row[1] for row in s_cur.fetchall()}
                else:
                    cols = set()
                if "tenant_id" in cols:
                    s_cur.execute(
                        """
                        SELECT email, endpoint, COALESCE(timestamp, CURRENT_TIMESTAMP) AS timestamp,
                               COALESCE(tenant_id, ?) AS tenant_id
                        FROM api_access_log
                        """,
                        (tenant_id,),
                    )
                else:
                    s_cur.execute(
                        """
                        SELECT email, endpoint, COALESCE(timestamp, CURRENT_TIMESTAMP) AS timestamp
                        FROM api_access_log
                        """
                    )
                rows = s_cur.fetchall()
                for r in rows:
                    row_tenant = r["tenant_id"] if "tenant_id" in r.keys() else tenant_id
                    cur.execute(
                        """
                        INSERT INTO api_access_log (tenant_id, email, endpoint, timestamp)
                        VALUES (%s, %s, %s, %s::timestamptz)
                        """,
                        (row_tenant, r["email"], r["endpoint"], str(r["timestamp"])),
                    )
                print(f"api_access_log migrated: {len(rows)}")

    src.close()
    print("Migration completed.")


if __name__ == "__main__":
    main()
