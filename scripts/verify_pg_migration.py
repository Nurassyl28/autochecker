"""Verify SQLite -> PostgreSQL migration counts.

Usage:
  export DB_PATH=bot.db
  export DATABASE_URL='postgresql://user:pass@localhost:5432/autochecker'
  export DEFAULT_TENANT_ID='default'
  uv run python scripts/verify_pg_migration.py
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parent.parent


def _sqlite_count(conn: sqlite3.Connection, table: str) -> int:
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
        (table,),
    )
    if cur.fetchone() is None:
        return 0
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    row = cur.fetchone()
    return int(row[0]) if row else 0


def _pg_count(dsn: str, table: str, tenant_id: str) -> int:
    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            if table == "users":
                cur.execute("SELECT COUNT(*) FROM users WHERE tenant_id = %s", (tenant_id,))
            elif table == "universities":
                cur.execute("SELECT COUNT(*) FROM universities")
            else:
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE tenant_id = %s", (tenant_id,))
            row = cur.fetchone()
            return int(row[0]) if row else 0


def main() -> None:
    db_path = (os.getenv("DB_PATH") or str(ROOT / "bot.db")).strip()
    dsn = (os.getenv("DATABASE_URL") or "").strip()
    tenant_id = (os.getenv("DEFAULT_TENANT_ID") or "default").strip() or "default"

    if not dsn:
        raise SystemExit("DATABASE_URL is empty.")
    if not Path(db_path).exists():
        raise SystemExit(f"SQLite DB does not exist: {db_path}")

    sqlite_tables = ["users", "attempts", "attempt_grants", "results", "api_access_log"]
    pg_tables = ["universities", "users", "attempts", "attempt_grants", "results", "api_access_log"]

    src = sqlite3.connect(db_path)
    src.row_factory = sqlite3.Row

    print("=== SQLite counts ===")
    sqlite_counts: dict[str, int] = {}
    for t in sqlite_tables:
        c = _sqlite_count(src, t)
        sqlite_counts[t] = c
        print(f"{t}: {c}")

    print("\n=== PostgreSQL counts ===")
    pg_counts: dict[str, int] = {}
    for t in pg_tables:
        c = _pg_count(dsn, t, tenant_id)
        pg_counts[t] = c
        print(f"{t}: {c}")

    src.close()

    print("\n=== Comparison (SQLite -> PostgreSQL) ===")
    ok = True
    for t in sqlite_tables:
        s = sqlite_counts[t]
        p = pg_counts.get(t, -1)
        mark = "OK" if s == p else "MISMATCH"
        if s != p:
            ok = False
        print(f"{t}: sqlite={s}, postgres={p} [{mark}]")

    if not ok:
        raise SystemExit("Migration verification failed: count mismatches found.")
    print("Migration verification passed.")


if __name__ == "__main__":
    main()
