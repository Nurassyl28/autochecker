---
tags: [database, sqlite, schema]
---

# 08 Data Model

Single SQLite database file. Owned by the bot, shared read/write with the dashboard. Path is `bot.db` by default (`DB_PATH` env var), mounted at `/app/data/bot.db` in production so it survives container rebuilds.

Schema migrations live in `bot/database.py` and run on bot startup. Current target is **schema v8**.

## Tables

### `_meta`

Single-row table that stores the current schema version.

```sql
CREATE TABLE _meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
-- row: ('schema_version', '8')
```

### `users`

One row per registered student.

| Column | Type | Notes |
|--------|------|-------|
| `tg_id` | INTEGER PRIMARY KEY | Telegram user ID |
| `email` | TEXT UNIQUE NOT NULL | Verified against `ALLOWED_EMAILS` whitelist |
| `github_alias` | TEXT UNIQUE NOT NULL | Used to build repo URLs |
| `tg_username` | TEXT | Telegram @handle |
| `is_admin` | BOOLEAN | Exempt from whitelist eviction |
| `registered_at` | DATETIME | Set at insert time |
| `server_ip` | TEXT | Student VM IP (v3) |
| `student_group` | TEXT | From Moodle CSV (v4) |
| `lms_api_key` | TEXT | Per-student token for `agent_eval` API calls (v6) |
| `vm_username` | TEXT | SSH username on student VM (v7) |

### `attempts`

Append-only log — one row per check attempt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | — |
| `tg_id` | INTEGER | FK to `users.tg_id` |
| `lab_id` | TEXT | e.g. `lab-03` |
| `task_id` | TEXT | e.g. `task-1` (empty string for legacy whole-lab attempts) |
| `timestamp` | DATETIME | Set at insert |

### `results`

Latest result per task per student.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | — |
| `tg_id` | INTEGER | FK to `users.tg_id` |
| `lab_id` | TEXT | — |
| `task_id` | TEXT | — |
| `score` | TEXT | Stored as e.g. `"85.7%"` |
| `passed` | INTEGER | Count of PASS checks |
| `failed` | INTEGER | Count of FAIL checks |
| `total` | INTEGER | Total checks run |
| `timestamp` | DATETIME | Set at insert |
| `details` | TEXT | Per-check breakdown (JSON or formatted text) (v2) |

### `api_access_log` (v5)

Used by lab-05 / lab-06 dashboard API routes (`/api/items`, `/api/logs`) to track which student made which request using their `LMS_API_KEY`.

| Column | Type |
|--------|------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT |
| `email` | TEXT NOT NULL |
| `endpoint` | TEXT NOT NULL |
| `timestamp` | DATETIME |

Indexed on `email`.

### `attempt_grants` (v8)

Instructor-granted extra attempts. The effective limit is `base_limit + sum(grants) − attempts_used`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | — |
| `tg_id` | INTEGER NOT NULL | FK to `users.tg_id` |
| `lab_id` | TEXT NOT NULL | — |
| `task_id` | TEXT NOT NULL | Empty string = applies to whole lab |
| `amount` | INTEGER NOT NULL | Positive = grant |
| `reason` | TEXT | Free-form admin note |
| `timestamp` | DATETIME | — |

Indexed on `(tg_id, lab_id, task_id)`.

## Migration history

Each migration is a no-op if the column/table already exists; the migration functions are idempotent.

| Version | Change | Function |
|---------|--------|----------|
| 0 | Legacy (users had `student_name`, `github_nick`) | — |
| 1 | Self-registration schema (`users.email`, `users.github_alias`); added `results` table | `_migrate_to_v1` |
| 2 | Added `results.details` | `_migrate_to_v2` |
| 3 | Added `users.server_ip` (VM deployment checks) | `_migrate_to_v3` |
| 4 | Added `users.student_group` | `_migrate_to_v4` |
| 5 | Added `api_access_log` table | `_migrate_to_v5` |
| 6 | Added `users.lms_api_key` | `_migrate_to_v6` |
| 7 | Added `users.vm_username` | `_migrate_to_v7` |
| 8 | Added `attempt_grants` table | `_migrate_to_v8` |

## Startup behavior

`bot/database.py:init_db()`:

1. Reads current `_meta.schema_version` (defaults to 0 if `_meta` doesn't exist)
2. Runs migrations in order up to `SCHEMA_VERSION = 8`
3. Writes new schema version
4. **Backfills `users.student_group`** from `bot/allowed_emails.csv` — applied on every startup, not just migrations, so adding a group to the CSV propagates on next restart

The dashboard performs a parallel safety-net `CREATE TABLE IF NOT EXISTS` for `api_access_log` and `attempt_grants` on its own startup. This means if the bot and dashboard come up in either order, both tables will exist.

## Authoritative write paths

| Table | Written by |
|-------|-----------|
| `users` | Bot (register handler, middleware eviction); Dashboard (edit form) |
| `attempts` | Bot (`add_attempt` on each check) |
| `results` | Bot (`save_result` after each check); Dashboard (mark-done, revert-done) |
| `attempt_grants` | Dashboard (grant form); `scripts/reset_attempts.py` (for bulk ops) |
| `api_access_log` | Dashboard (logged on each `/api/*` call) |
| `_meta` | Bot (migration code only) |

## Golden rule: scope DELETEs

Every DELETE on `attempts`, `results`, or `attempt_grants` must include **both** `lab_id` and `task_id`. A past incident used `DELETE FROM results WHERE task_id = 'task-3'` without a lab scope, which wiped task-3 across all labs (lost lab-05 completion data). See [[13 Gotchas]].

```sql
-- WRONG
DELETE FROM results WHERE task_id = 'task-3';

-- CORRECT
DELETE FROM results WHERE lab_id = 'lab-06' AND task_id = 'task-3';
```

## Backup

The bot DB is on a named Docker volume (`bot-data`). For a backup:

```bash
docker run --rm -v deploy_bot-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/bot-db-$(date +%F).tar.gz /data/bot.db
```

## Related notes

- [[05 Telegram Bot]] — write paths from the bot
- [[06 Dashboard]] — write paths from the dashboard
- [[09 Deployment]] — volume mount, `DB_PATH` env var
- [[13 Gotchas]] — the DELETE-without-lab-id incident
