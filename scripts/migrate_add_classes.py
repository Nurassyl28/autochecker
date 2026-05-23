"""
Apply the classes/class_members migration.

Usage:
    uv run python scripts/migrate_add_classes.py
"""

import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
MIGRATION_FILE = ROOT / "db" / "migrate_add_classes.sql"

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL env var is not set.")


def main():
    sql = MIGRATION_FILE.read_text()
    print(f"Connecting to: {DATABASE_URL[:40]}...")
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
    print("Migration applied: classes + class_members tables created (if not already exist).")


if __name__ == "__main__":
    main()
