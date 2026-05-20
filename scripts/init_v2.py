"""
Initialize the v2 PostgreSQL schema and create the first university + admin user.

Usage:
    uv run python scripts/init_v2.py
    uv run python scripts/init_v2.py --university "MIT" --slug "mit" --email "admin@mit.edu" --password "secret"
"""

import argparse
import os
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / "db" / "schema_v2.sql"

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL env var is not set.")


def run(sql: str, params: tuple = (), conn=None) -> None:
    if conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
    else:
        with psycopg.connect(DATABASE_URL, autocommit=True) as c:
            with c.cursor() as cur:
                cur.execute(sql, params)


def main():
    parser = argparse.ArgumentParser(description="Init v2 schema and bootstrap admin")
    parser.add_argument("--university", default="Default University")
    parser.add_argument("--slug", default="default")
    parser.add_argument("--email", default="admin@example.com")
    parser.add_argument("--password", default="admin123")
    args = parser.parse_args()

    print(f"Connecting to: {DATABASE_URL[:40]}...")

    # 1. Apply schema
    schema_sql = SCHEMA_FILE.read_text()
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        print("Applying schema_v2.sql ...")
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        print("Schema applied.")

        # 2. Create university (skip if exists)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "INSERT INTO universities (name, slug) VALUES (%s, %s) ON CONFLICT (slug) DO NOTHING RETURNING id",
                (args.university, args.slug),
            )
            row = cur.fetchone()
            if row:
                univ_id = row["id"]
                print(f"Created university '{args.university}' (id={univ_id})")
            else:
                cur.execute("SELECT id FROM universities WHERE slug = %s", (args.slug,))
                univ_id = cur.fetchone()["id"]
                print(f"University '{args.slug}' already exists (id={univ_id})")

        # 3. Create admin user (skip if exists)
        # Import here so we don't need the full app context
        sys.path.insert(0, str(ROOT))
        from api.auth import hash_password

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO users (university_id, email, password_hash, role, full_name)
                VALUES (%s, %s, %s, 'admin', 'Admin')
                ON CONFLICT (university_id, email) DO NOTHING
                RETURNING id
                """,
                (univ_id, args.email, hash_password(args.password)),
            )
            row = cur.fetchone()
            if row:
                print(f"Created admin user: {args.email} (id={row['id']})")
            else:
                print(f"Admin user {args.email} already exists, skipped.")

    print("\nDone. Start the server with:")
    print("  uv run uvicorn api.app:app --reload --port 8000")
    print(f"\nLogin: POST /auth/login  {{email: '{args.email}', password: '{args.password}'}}")


if __name__ == "__main__":
    main()
