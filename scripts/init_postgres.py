"""Initialize PostgreSQL schema for multi-tenant autochecker."""

from __future__ import annotations

import os
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "db" / "postgres_schema.sql"


def main() -> None:
    dsn = (os.getenv("DATABASE_URL") or "").strip()
    default_tenant = (os.getenv("DEFAULT_TENANT_ID") or "default").strip() or "default"
    default_tenant_name = (os.getenv("DEFAULT_TENANT_NAME") or "Default University").strip()

    if not dsn:
        raise SystemExit("DATABASE_URL is empty. Set PostgreSQL DSN in env first.")

    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                """
                INSERT INTO universities (id, name)
                VALUES (%s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (default_tenant, default_tenant_name),
            )
    print(f"PostgreSQL schema initialized. Default tenant: {default_tenant}")


if __name__ == "__main__":
    main()
