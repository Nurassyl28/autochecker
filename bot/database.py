"""Database module for SQLite operations."""

import logging
import asyncio
from pathlib import Path

import aiosqlite
from datetime import datetime
from typing import Optional
from dataclasses import dataclass
import psycopg
from psycopg.rows import dict_row

from .config import DB_PATH, DATABASE_URL, DEFAULT_TENANT_ID, get_max_attempts

logger = logging.getLogger(__name__)
USE_POSTGRES = bool(DATABASE_URL)


def _to_pg_query(sql: str) -> str:
    """Convert sqlite-style placeholders to psycopg style."""
    return sql.replace("?", "%s")


def _pg_fetchone_sync(sql: str, params: tuple = ()) -> Optional[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(_to_pg_query(sql), params)
            row = cur.fetchone()
            return dict(row) if row else None


def _pg_fetchall_sync(sql: str, params: tuple = ()) -> list[dict]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(_to_pg_query(sql), params)
            return [dict(r) for r in cur.fetchall()]


def _pg_execute_sync(sql: str, params: tuple = ()) -> None:
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(_to_pg_query(sql), params)


@dataclass
class User:
    """User data model."""
    tg_id: int
    email: str
    github_alias: str
    tg_username: str
    is_admin: bool
    role: str = "student"
    tenant_id: str = DEFAULT_TENANT_ID


# ---------------------------------------------------------------------------
# Schema version history:
#   0 — legacy (users: tg_id, student_name, github_nick, is_admin)
#   1 — self-registration + results table
# ---------------------------------------------------------------------------
SCHEMA_VERSION = 9


async def _get_table_columns(db: aiosqlite.Connection, table: str) -> set[str]:
    """Return set of column names for a table (empty set if table missing)."""
    cols = set()
    try:
        async with db.execute(f"PRAGMA table_info({table})") as cur:
            async for row in cur:
                cols.add(row[1])
    except Exception:
        pass
    return cols


async def _get_schema_version(db: aiosqlite.Connection) -> int:
    """Read current schema version (0 if meta table doesn't exist)."""
    try:
        async with db.execute("SELECT value FROM _meta WHERE key = 'schema_version'") as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else 0
    except Exception:
        return 0


async def _set_schema_version(db: aiosqlite.Connection, version: int) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT)
    """)
    await db.execute(
        "INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)",
        (str(version),)
    )


async def init_db() -> None:
    """Initialize or migrate the database to the latest schema."""
    if USE_POSTGRES:
        logger.info(
            "DATABASE_URL is set: skipping SQLite init_db(). "
            "Initialize PostgreSQL using scripts/init_postgres.py."
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        version = await _get_schema_version(db)
        logger.info("Current DB schema version: %d (target: %d)", version, SCHEMA_VERSION)

        if version < 1:
            await _migrate_to_v1(db)
        if version < 2:
            await _migrate_to_v2(db)
        if version < 3:
            await _migrate_to_v3(db)
        if version < 4:
            await _migrate_to_v4(db)
        if version < 5:
            await _migrate_to_v5(db)
        if version < 6:
            await _migrate_to_v6(db)
        if version < 7:
            await _migrate_to_v7(db)
        if version < 8:
            await _migrate_to_v8(db)
        if version < 9:
            await _migrate_to_v9(db)

        await _set_schema_version(db, SCHEMA_VERSION)
        await db.commit()
        logger.info("DB ready at schema version %d", SCHEMA_VERSION)

        # Backfill groups from allowed_emails.csv on every startup
        await _backfill_groups(db)
        await db.commit()


async def _migrate_to_v1(db: aiosqlite.Connection) -> None:
    """Migrate from v0 (legacy) to v1 (self-registration + results)."""
    user_cols = await _get_table_columns(db, "users")

    if not user_cols:
        # Fresh DB — create tables from scratch
        logger.info("Creating tables (fresh DB)")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                tg_id         INTEGER PRIMARY KEY,
                email         TEXT NOT NULL UNIQUE,
                github_alias  TEXT NOT NULL UNIQUE,
                tg_username   TEXT DEFAULT '',
                is_admin      BOOLEAN DEFAULT 0,
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        # Existing users table — add missing columns
        if "email" not in user_cols:
            logger.info("Migration v1: adding email column")
            await db.execute("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''")
        if "github_alias" not in user_cols:
            logger.info("Migration v1: adding github_alias column")
            await db.execute("ALTER TABLE users ADD COLUMN github_alias TEXT NOT NULL DEFAULT ''")
        if "tg_username" not in user_cols:
            logger.info("Migration v1: adding tg_username column")
            await db.execute("ALTER TABLE users ADD COLUMN tg_username TEXT DEFAULT ''")
        if "registered_at" not in user_cols:
            logger.info("Migration v1: adding registered_at column")
            await db.execute("ALTER TABLE users ADD COLUMN registered_at DATETIME DEFAULT ''")
            await db.execute("UPDATE users SET registered_at = CURRENT_TIMESTAMP WHERE registered_at = ''")

        # Migrate data from old columns if they exist
        if "github_nick" in user_cols:
            logger.info("Migration v1: copying github_nick -> github_alias")
            await db.execute("UPDATE users SET github_alias = github_nick WHERE github_alias = ''")
        if "student_name" in user_cols:
            logger.info("Migration v1: copying student_name -> email placeholder")
            await db.execute(
                "UPDATE users SET email = student_name || '@migrated' WHERE email = ''"
            )

        # Drop legacy columns after data migration (SQLite 3.35+)
        for old_col in ("student_name", "github_nick"):
            if old_col in user_cols:
                try:
                    logger.info("Migration v1: dropping legacy column %s", old_col)
                    await db.execute(f"ALTER TABLE users DROP COLUMN {old_col}")
                except aiosqlite.OperationalError:
                    pass  # SQLite too old or column already dropped

        # Create unique indexes if not present (ignore errors if they exist
        # or if migrated data has duplicates)
        for col in ("email", "github_alias"):
            try:
                await db.execute(f"CREATE UNIQUE INDEX idx_users_{col} ON users({col})")
            except (aiosqlite.OperationalError, aiosqlite.IntegrityError):
                pass

    # Attempts table (unchanged schema, just ensure it exists)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS attempts (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            tg_id     INTEGER NOT NULL,
            lab_id    TEXT NOT NULL,
            task_id   TEXT NOT NULL DEFAULT '',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tg_id) REFERENCES users(tg_id)
        )
    """)
    # Migration from older attempts table without task_id
    attempt_cols = await _get_table_columns(db, "attempts")
    if attempt_cols and "task_id" not in attempt_cols:
        await db.execute("ALTER TABLE attempts ADD COLUMN task_id TEXT NOT NULL DEFAULT ''")

    # Results table (new in v1)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            tg_id     INTEGER NOT NULL,
            lab_id    TEXT NOT NULL,
            task_id   TEXT NOT NULL,
            score     TEXT,
            passed    INTEGER,
            failed    INTEGER,
            total     INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tg_id) REFERENCES users(tg_id)
        )
    """)

    logger.info("Migration to v1 complete")


async def _migrate_to_v2(db: aiosqlite.Connection) -> None:
    """Add details column to results table for per-check breakdown."""
    result_cols = await _get_table_columns(db, "results")
    if "details" not in result_cols:
        logger.info("Migration v2: adding details column to results")
        await db.execute("ALTER TABLE results ADD COLUMN details TEXT DEFAULT ''")
    logger.info("Migration to v2 complete")


async def _migrate_to_v3(db: aiosqlite.Connection) -> None:
    """Add server_ip column to users table for VM deployment checks."""
    user_cols = await _get_table_columns(db, "users")
    if "server_ip" not in user_cols:
        logger.info("Migration v3: adding server_ip column to users")
        await db.execute("ALTER TABLE users ADD COLUMN server_ip TEXT DEFAULT ''")
    logger.info("Migration to v3 complete")


async def _migrate_to_v4(db: aiosqlite.Connection) -> None:
    """Add student_group column to users table."""
    user_cols = await _get_table_columns(db, "users")
    if "student_group" not in user_cols:
        logger.info("Migration v4: adding student_group column to users")
        await db.execute("ALTER TABLE users ADD COLUMN student_group TEXT DEFAULT ''")
    logger.info("Migration to v4 complete")


async def _migrate_to_v5(db: aiosqlite.Connection) -> None:
    """Create api_access_log table for tracking student API calls."""
    await db.execute("""
        CREATE TABLE IF NOT EXISTS api_access_log (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            email     TEXT NOT NULL,
            endpoint  TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_access_email ON api_access_log(email)"
    )
    logger.info("Migration to v5 complete")


async def _migrate_to_v6(db: aiosqlite.Connection) -> None:
    """Add lms_api_key column to users table for agent eval."""
    user_cols = await _get_table_columns(db, "users")
    if "lms_api_key" not in user_cols:
        logger.info("Migration v6: adding lms_api_key column to users")
        await db.execute("ALTER TABLE users ADD COLUMN lms_api_key TEXT DEFAULT ''")
    logger.info("Migration to v6 complete")


async def _migrate_to_v7(db: aiosqlite.Connection) -> None:
    """Add vm_username column to users table for SSH-based agent eval."""
    user_cols = await _get_table_columns(db, "users")
    if "vm_username" not in user_cols:
        logger.info("Migration v7: adding vm_username column to users")
        await db.execute("ALTER TABLE users ADD COLUMN vm_username TEXT DEFAULT ''")
    logger.info("Migration to v7 complete")


async def _migrate_to_v8(db: aiosqlite.Connection) -> None:
    """Track instructor-granted attempts without deleting attempt history."""
    await db.execute("""
        CREATE TABLE IF NOT EXISTS attempt_grants (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            tg_id     INTEGER NOT NULL,
            lab_id    TEXT NOT NULL,
            task_id   TEXT NOT NULL DEFAULT '',
            amount    INTEGER NOT NULL,
            reason    TEXT DEFAULT '',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tg_id) REFERENCES users(tg_id)
        )
    """)
    await db.execute(
        """CREATE INDEX IF NOT EXISTS idx_attempt_grants_lookup
           ON attempt_grants(tg_id, lab_id, task_id)"""
    )
    logger.info("Migration to v8 complete")


async def _migrate_to_v9(db: aiosqlite.Connection) -> None:
    """Add multi-tenant and RBAC columns."""
    user_cols = await _get_table_columns(db, "users")
    if "tenant_id" not in user_cols:
        logger.info("Migration v9: adding tenant_id to users")
        await db.execute("ALTER TABLE users ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'")
    if "role" not in user_cols:
        logger.info("Migration v9: adding role to users")
        await db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")

    results_cols = await _get_table_columns(db, "results")
    if "tenant_id" not in results_cols:
        logger.info("Migration v9: adding tenant_id to results")
        await db.execute("ALTER TABLE results ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'")

    attempts_cols = await _get_table_columns(db, "attempts")
    if "tenant_id" not in attempts_cols:
        logger.info("Migration v9: adding tenant_id to attempts")
        await db.execute("ALTER TABLE attempts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'")

    grants_cols = await _get_table_columns(db, "attempt_grants")
    if "tenant_id" not in grants_cols:
        logger.info("Migration v9: adding tenant_id to attempt_grants")
        await db.execute("ALTER TABLE attempt_grants ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'")

    await db.execute("CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_results_tenant ON results(tenant_id)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_attempts_tenant ON attempts(tenant_id)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_attempt_grants_tenant ON attempt_grants(tenant_id)")
    logger.info("Migration to v9 complete")


async def get_vm_username(tg_id: int) -> str:
    """Get stored VM username for a user. Returns empty string if not set."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT vm_username FROM users WHERE tg_id = %s",
            (tg_id,),
        )
        return (row.get("vm_username") or "") if row else ""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT vm_username FROM users WHERE tg_id = ?", (tg_id,)
        ) as cur:
            row = await cur.fetchone()
            return (row[0] or "") if row else ""


async def set_vm_username(tg_id: int, username: str) -> None:
    """Store VM username for a user."""
    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            "UPDATE users SET vm_username = %s WHERE tg_id = %s",
            (username, tg_id),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET vm_username = ? WHERE tg_id = ?", (username, tg_id)
        )
        await db.commit()


async def get_lms_api_key(tg_id: int) -> str:
    """Get stored LMS API key for a user. Returns empty string if not set."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT lms_api_key FROM users WHERE tg_id = %s",
            (tg_id,),
        )
        return (row.get("lms_api_key") or "") if row else ""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT lms_api_key FROM users WHERE tg_id = ?", (tg_id,)
        ) as cur:
            row = await cur.fetchone()
            return (row[0] or "") if row else ""


async def set_lms_api_key(tg_id: int, key: str) -> None:
    """Store LMS API key for a user."""
    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            "UPDATE users SET lms_api_key = %s WHERE tg_id = %s",
            (key, tg_id),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET lms_api_key = ? WHERE tg_id = ?", (key, tg_id)
        )
        await db.commit()


async def log_api_access(email: str, endpoint: str) -> None:
    """Record that a student called an API endpoint."""
    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            "INSERT INTO api_access_log (tenant_id, email, endpoint) VALUES (%s, %s, %s)",
            (DEFAULT_TENANT_ID, email, endpoint),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO api_access_log (email, endpoint) VALUES (?, ?)",
            (email, endpoint),
        )
        await db.commit()


async def get_api_access_summary(email: str) -> list[dict]:
    """Return distinct endpoints a student has called, with counts and first/last timestamps."""
    if USE_POSTGRES:
        return await asyncio.to_thread(
            _pg_fetchall_sync,
            """
            SELECT endpoint, COUNT(*) as call_count,
                   MIN(timestamp) as first_call, MAX(timestamp) as last_call
            FROM api_access_log
            WHERE tenant_id = %s AND email = %s
            GROUP BY endpoint
            """,
            (DEFAULT_TENANT_ID, email),
        )
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT endpoint, COUNT(*) as call_count,
                   MIN(timestamp) as first_call, MAX(timestamp) as last_call
            FROM api_access_log
            WHERE email = ?
            GROUP BY endpoint
            """,
            (email,),
        ) as cur:
            return [dict(row) async for row in cur]


async def _backfill_groups(db: aiosqlite.Connection) -> None:
    """Sync student groups from allowed_emails.csv into the users table."""
    import csv as _csv
    csv_path = Path(__file__).resolve().parent / "allowed_emails.csv"
    if not csv_path.exists():
        return
    email_to_group: dict[str, str] = {}
    with open(csv_path, encoding="utf-8") as f:
        for row in _csv.DictReader(f):
            email = row["email"].strip().lower()
            group = row["group"].strip()
            if email and group:
                email_to_group[email] = group
    if not email_to_group:
        return
    for email, group in email_to_group.items():
        await db.execute(
            "UPDATE users SET student_group = ? WHERE email = ? AND (student_group IS NULL OR student_group = '')",
            (group, email),
        )
    logger.info("Backfilled groups for %d emails", len(email_to_group))


async def get_server_ip(tg_id: int) -> str:
    """Get stored server IP for a user. Returns empty string if not set."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT server_ip FROM users WHERE tg_id = %s",
            (tg_id,),
        )
        return (row.get("server_ip") or "") if row else ""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT server_ip FROM users WHERE tg_id = ?", (tg_id,)
        ) as cur:
            row = await cur.fetchone()
            return (row[0] or "") if row else ""


async def get_server_ip_owner(ip: str, exclude_tg_id: int) -> Optional[str]:
    """Check if a server IP is already used by another student. Returns github_alias or None."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT github_alias FROM users WHERE server_ip = %s AND tg_id != %s",
            (ip, exclude_tg_id),
        )
        return row.get("github_alias") if row else None
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT github_alias FROM users WHERE server_ip = ? AND tg_id != ?", (ip, exclude_tg_id)
        ) as cur:
            row = await cur.fetchone()
            return row[0] if row else None


async def set_server_ip(tg_id: int, ip: str) -> None:
    """Store server IP for a user."""
    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            "UPDATE users SET server_ip = %s WHERE tg_id = %s",
            (ip, tg_id),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET server_ip = ? WHERE tg_id = ?", (ip, tg_id)
        )
        await db.commit()


async def get_user(tg_id: int) -> Optional[User]:
    """Get user by Telegram ID."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id FROM users WHERE tg_id = %s",
            (tg_id,),
        )
        if row:
            return User(
                tg_id=row["tg_id"],
                email=row["email"],
                github_alias=row["github_alias"],
                tg_username=row["tg_username"],
                is_admin=bool(row["is_admin"]),
                role=row.get("role") or "student",
                tenant_id=row.get("tenant_id") or DEFAULT_TENANT_ID,
            )
        return None
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id FROM users WHERE tg_id = ?",
            (tg_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return User(
                    tg_id=row["tg_id"],
                    email=row["email"],
                    github_alias=row["github_alias"],
                    tg_username=row["tg_username"],
                    is_admin=bool(row["is_admin"]),
                    role=row["role"] or "student",
                    tenant_id=row["tenant_id"] or DEFAULT_TENANT_ID,
                )
            return None


async def delete_user(tg_id: int) -> None:
    """Delete user by Telegram ID."""
    if USE_POSTGRES:
        await asyncio.to_thread(_pg_execute_sync, "DELETE FROM users WHERE tg_id = %s", (tg_id,))
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM users WHERE tg_id = ?", (tg_id,))
        await db.commit()


async def get_user_by_email(email: str) -> Optional[User]:
    """Get user by email address."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id FROM users WHERE tenant_id = %s AND email = %s",
            (DEFAULT_TENANT_ID, email),
        )
        if row:
            return User(
                tg_id=row["tg_id"],
                email=row["email"],
                github_alias=row["github_alias"],
                tg_username=row["tg_username"],
                is_admin=bool(row["is_admin"]),
                role=row.get("role") or "student",
                tenant_id=row.get("tenant_id") or DEFAULT_TENANT_ID,
            )
        return None
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id FROM users WHERE email = ?",
            (email,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return User(
                    tg_id=row["tg_id"],
                    email=row["email"],
                    github_alias=row["github_alias"],
                    tg_username=row["tg_username"],
                    is_admin=bool(row["is_admin"]),
                    role=row["role"] or "student",
                    tenant_id=row["tenant_id"] or DEFAULT_TENANT_ID,
                )
            return None


async def get_user_by_github(github_alias: str) -> Optional[User]:
    """Get user by GitHub alias."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id FROM users WHERE tenant_id = %s AND github_alias = %s",
            (DEFAULT_TENANT_ID, github_alias),
        )
        if row:
            return User(
                tg_id=row["tg_id"],
                email=row["email"],
                github_alias=row["github_alias"],
                tg_username=row["tg_username"],
                is_admin=bool(row["is_admin"]),
                role=row.get("role") or "student",
                tenant_id=row.get("tenant_id") or DEFAULT_TENANT_ID,
            )
        return None
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id FROM users WHERE github_alias = ?",
            (github_alias,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return User(
                    tg_id=row["tg_id"],
                    email=row["email"],
                    github_alias=row["github_alias"],
                    tg_username=row["tg_username"],
                    is_admin=bool(row["is_admin"]),
                    role=row["role"] or "student",
                    tenant_id=row["tenant_id"] or DEFAULT_TENANT_ID,
                )
            return None


async def upsert_user(
    tg_id: int,
    email: str,
    github_alias: str,
    tg_username: str = "",
    student_group: str = "",
    tenant_id: str = DEFAULT_TENANT_ID,
    role: str = "student",
) -> None:
    """Create or update a user.

    First-come-first-served: if the email or github_alias already belongs
    to a different Telegram account, the operation is rejected with a
    ValueError so the handler can inform the student.
    """
    if USE_POSTGRES:
        # uniqueness in tenant scope
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT tg_id FROM users WHERE tenant_id = %s AND email = %s AND tg_id != %s",
            (tenant_id, email, tg_id),
        )
        if row:
            raise ValueError(f"Email {email} is already registered to another account.")
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT tg_id FROM users WHERE tenant_id = %s AND github_alias = %s AND tg_id != %s",
            (tenant_id, github_alias, tg_id),
        )
        if row:
            raise ValueError(f"GitHub username {github_alias} is already registered to another account.")

        await asyncio.to_thread(
            _pg_execute_sync,
            """
            INSERT INTO users (
                tg_id, tenant_id, role, email, github_alias, tg_username, student_group
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(tg_id) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                role = EXCLUDED.role,
                email = EXCLUDED.email,
                github_alias = EXCLUDED.github_alias,
                tg_username = EXCLUDED.tg_username,
                student_group = EXCLUDED.student_group
            """,
            (tg_id, tenant_id, role, email, github_alias, tg_username, student_group),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Check email uniqueness
        async with db.execute(
            "SELECT tg_id FROM users WHERE email = ? AND tg_id != ?", (email, tg_id)
        ) as cur:
            if await cur.fetchone():
                raise ValueError(f"Email {email} is already registered to another account.")

        # Check github_alias uniqueness
        async with db.execute(
            "SELECT tg_id FROM users WHERE github_alias = ? AND tg_id != ?", (github_alias, tg_id)
        ) as cur:
            if await cur.fetchone():
                raise ValueError(f"GitHub username {github_alias} is already registered to another account.")

        await db.execute("""
            INSERT INTO users (tg_id, email, github_alias, tg_username, student_group, tenant_id, role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tg_id) DO UPDATE SET
                email = excluded.email,
                github_alias = excluded.github_alias,
                tg_username = excluded.tg_username,
                student_group = excluded.student_group,
                tenant_id = excluded.tenant_id,
                role = excluded.role
        """, (tg_id, email, github_alias, tg_username, student_group, tenant_id, role))
        await db.commit()


async def get_attempts_count(tg_id: int, lab_id: str, task_id: str = "") -> int:
    """Get the number of attempts for a specific task by user."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            "SELECT COUNT(*) AS cnt FROM attempts WHERE tenant_id = %s AND tg_id = %s AND lab_id = %s AND task_id = %s",
            (DEFAULT_TENANT_ID, tg_id, lab_id, task_id),
        )
        return int(row["cnt"]) if row else 0
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(*) FROM attempts WHERE tg_id = ? AND lab_id = ? AND task_id = ?",
            (tg_id, lab_id, task_id)
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0


async def get_attempt_grants(tg_id: int, lab_id: str, task_id: str = "") -> int:
    """Get the total number of instructor-granted attempts for a task."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            """SELECT COALESCE(SUM(amount), 0) AS total
               FROM attempt_grants
               WHERE tenant_id = %s AND tg_id = %s AND lab_id = %s AND task_id = %s""",
            (DEFAULT_TENANT_ID, tg_id, lab_id, task_id),
        )
        return int(row["total"]) if row and row["total"] is not None else 0
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT COALESCE(SUM(amount), 0)
               FROM attempt_grants
               WHERE tg_id = ? AND lab_id = ? AND task_id = ?""",
            (tg_id, lab_id, task_id),
        ) as cursor:
            row = await cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else 0


async def add_attempt_grant(
    tg_id: int,
    lab_id: str,
    task_id: str = "",
    amount: int = 0,
    reason: str = "",
) -> None:
    """Record extra attempts granted by an instructor."""
    if amount <= 0:
        return

    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            """INSERT INTO attempt_grants (tenant_id, tg_id, lab_id, task_id, amount, reason, timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (DEFAULT_TENANT_ID, tg_id, lab_id, task_id, amount, reason, datetime.now().isoformat()),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO attempt_grants (tg_id, lab_id, task_id, amount, reason, timestamp)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (tg_id, lab_id, task_id, amount, reason, datetime.now().isoformat()),
        )
        await db.commit()


async def get_effective_attempt_limit(tg_id: int, lab_id: str, task_id: str = "") -> int:
    """Return base max attempts plus any instructor-granted attempts."""
    return get_max_attempts(lab_id, task_id) + await get_attempt_grants(tg_id, lab_id, task_id)


async def add_attempt(tg_id: int, lab_id: str, task_id: str = "") -> None:
    """Record a new attempt for a task."""
    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            "INSERT INTO attempts (tenant_id, tg_id, lab_id, task_id, timestamp) VALUES (%s, %s, %s, %s, %s)",
            (DEFAULT_TENANT_ID, tg_id, lab_id, task_id, datetime.now().isoformat()),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO attempts (tg_id, lab_id, task_id, tenant_id, timestamp) VALUES (?, ?, ?, ?, ?)",
            (tg_id, lab_id, task_id, DEFAULT_TENANT_ID, datetime.now().isoformat())
        )
        await db.commit()


async def save_result(
    tg_id: int,
    lab_id: str,
    task_id: str,
    score: Optional[str] = None,
    passed: Optional[int] = None,
    failed: Optional[int] = None,
    total: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    """Save a check result to the database."""
    if USE_POSTGRES:
        await asyncio.to_thread(
            _pg_execute_sync,
            """INSERT INTO results (tenant_id, tg_id, lab_id, task_id, score, passed, failed, total, details, timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)""",
            (
                DEFAULT_TENANT_ID,
                tg_id,
                lab_id,
                task_id,
                score,
                passed,
                failed,
                total,
                details or "[]",
                datetime.now().isoformat(),
            ),
        )
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO results (tg_id, lab_id, task_id, score, passed, failed, total, details, tenant_id, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (tg_id, lab_id, task_id, score, passed, failed, total, details or "", DEFAULT_TENANT_ID, datetime.now().isoformat())
        )
        await db.commit()


async def get_task_stats(tg_id: int) -> dict[str, dict]:
    """Get best score and attempt count for each task.

    "Best" = fewest failures, then most passes (matches dashboard logic).

    Returns dict keyed by 'lab_id:task_id' with values:
        {
            'attempts': int,
            'granted_attempts': int,
            'max_attempts': int,
            'remaining': int,
            'score': str|None,
            'passed': int|None,
            'failed': int|None,
            'total': int|None,
        }
    """
    stats: dict[str, dict] = {}
    if USE_POSTGRES:
        attempt_rows = await asyncio.to_thread(
            _pg_fetchall_sync,
            """SELECT lab_id, task_id, COUNT(*) as cnt
               FROM attempts
               WHERE tenant_id = %s AND tg_id = %s
               GROUP BY lab_id, task_id""",
            (DEFAULT_TENANT_ID, tg_id),
        )
        for row in attempt_rows:
            key = f"{row['lab_id']}:{row['task_id']}"
            stats[key] = {"attempts": row["cnt"], "score": None, "passed": None, "failed": None, "total": None}

        grant_rows = await asyncio.to_thread(
            _pg_fetchall_sync,
            """SELECT lab_id, task_id, COALESCE(SUM(amount), 0) as granted
               FROM attempt_grants
               WHERE tenant_id = %s AND tg_id = %s
               GROUP BY lab_id, task_id""",
            (DEFAULT_TENANT_ID, tg_id),
        )
        for row in grant_rows:
            key = f"{row['lab_id']}:{row['task_id']}"
            stats.setdefault(key, {"attempts": 0, "score": None, "passed": None, "failed": None, "total": None})
            stats[key]["granted_attempts"] = int(row["granted"] or 0)

        result_rows = await asyncio.to_thread(
            _pg_fetchall_sync,
            """SELECT lab_id, task_id, score, passed, failed, total
               FROM results
               WHERE tenant_id = %s AND tg_id = %s""",
            (DEFAULT_TENANT_ID, tg_id),
        )
        for row in result_rows:
            key = f"{row['lab_id']}:{row['task_id']}"
            if key not in stats:
                stats[key] = {"attempts": 0}
            cur_p = row["passed"] or 0
            cur_np = (row["total"] or 0) - cur_p
            prev = stats[key]
            prev_p = prev.get("passed") or 0
            prev_np = (prev.get("total") or 0) - prev_p
            if prev.get("score") is None or (-cur_p, cur_np) < (-prev_p, prev_np):
                stats[key].update({
                    "score": row["score"],
                    "passed": row["passed"],
                    "failed": row["failed"],
                    "total": row["total"],
                })

        for key, value in stats.items():
            lab_id, task_id = key.split(":", 1)
            granted = int(value.get("granted_attempts", 0) or 0)
            max_attempts = get_max_attempts(lab_id, task_id) + granted
            attempts = int(value.get("attempts", 0) or 0)
            value["granted_attempts"] = granted
            value["max_attempts"] = max_attempts
            value["remaining"] = max(0, max_attempts - attempts)
        return stats

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Attempt counts
        async with db.execute(
            "SELECT lab_id, task_id, COUNT(*) as cnt FROM attempts WHERE tg_id = ? GROUP BY lab_id, task_id",
            (tg_id,)
        ) as cur:
            async for row in cur:
                key = f"{row['lab_id']}:{row['task_id']}"
                stats[key] = {"attempts": row["cnt"], "score": None, "passed": None, "failed": None, "total": None}

        # Instructor-granted bonus attempts
        async with db.execute(
            """SELECT lab_id, task_id, COALESCE(SUM(amount), 0) as granted
               FROM attempt_grants WHERE tg_id = ? GROUP BY lab_id, task_id""",
            (tg_id,)
        ) as cur:
            async for row in cur:
                key = f"{row['lab_id']}:{row['task_id']}"
                stats.setdefault(key, {"attempts": 0, "score": None, "passed": None, "failed": None, "total": None})
                stats[key]["granted_attempts"] = int(row["granted"] or 0)

        # Best result per task (most passes, then fewest non-passes).
        # Uses (total - passed) instead of raw failed, because ERROR checks
        # have failed=0 but aren't passes — they shouldn't beat real results.
        async with db.execute("""
            SELECT lab_id, task_id, score, passed, failed, total
            FROM results WHERE tg_id = ?
        """, (tg_id,)) as cur:
            async for row in cur:
                key = f"{row['lab_id']}:{row['task_id']}"
                if key not in stats:
                    stats[key] = {"attempts": 0}
                cur_p = row["passed"] or 0
                cur_np = (row["total"] or 0) - cur_p
                prev = stats[key]
                prev_p = prev.get("passed") or 0
                prev_np = (prev.get("total") or 0) - prev_p
                if prev.get("score") is None or (-cur_p, cur_np) < (-prev_p, prev_np):
                    stats[key].update({
                        "score": row["score"],
                        "passed": row["passed"],
                        "failed": row["failed"],
                        "total": row["total"],
                    })

    for key, value in stats.items():
        lab_id, task_id = key.split(":", 1)
        granted = int(value.get("granted_attempts", 0) or 0)
        max_attempts = get_max_attempts(lab_id, task_id) + granted
        attempts = int(value.get("attempts", 0) or 0)
        value["granted_attempts"] = granted
        value["max_attempts"] = max_attempts
        value["remaining"] = max(0, max_attempts - attempts)

    return stats


async def has_passed_task(tg_id: int, lab_id: str, task_id: str) -> bool:
    """Check if a user has passed a task (failed_checks == 0 with total > 0)."""
    if USE_POSTGRES:
        row = await asyncio.to_thread(
            _pg_fetchone_sync,
            """SELECT 1 AS ok FROM results
               WHERE tenant_id = %s AND tg_id = %s AND lab_id = %s AND task_id = %s
                 AND failed = 0 AND total > 0 LIMIT 1""",
            (DEFAULT_TENANT_ID, tg_id, lab_id, task_id),
        )
        return row is not None
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT 1 FROM results WHERE tg_id = ? AND lab_id = ? AND task_id = ? AND failed = 0 AND total > 0 LIMIT 1",
            (tg_id, lab_id, task_id)
        ) as cur:
            return await cur.fetchone() is not None


async def get_all_users() -> list[User]:
    """Get all users from the database."""
    if USE_POSTGRES:
        rows = await asyncio.to_thread(
            _pg_fetchall_sync,
            """SELECT tg_id, email, github_alias, tg_username, is_admin, role, tenant_id
               FROM users WHERE tenant_id = %s ORDER BY github_alias""",
            (DEFAULT_TENANT_ID,),
        )
        return [
            User(
                tg_id=row["tg_id"],
                email=row["email"],
                github_alias=row["github_alias"],
                tg_username=row["tg_username"],
                is_admin=bool(row["is_admin"]),
                role=row.get("role") or "student",
                tenant_id=row.get("tenant_id") or DEFAULT_TENANT_ID,
            )
            for row in rows
        ]
    users = []
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT tg_id, email, github_alias, tg_username, is_admin FROM users ORDER BY github_alias"
        ) as cursor:
            async for row in cursor:
                users.append(User(
                    tg_id=row["tg_id"],
                    email=row["email"],
                    github_alias=row["github_alias"],
                    tg_username=row["tg_username"],
                    is_admin=bool(row["is_admin"])
                ))
    return users
