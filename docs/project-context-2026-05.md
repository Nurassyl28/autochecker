# Project Context (May 2026)

This document captures the current baseline after the latest backend+AI updates.

## Product State

- Autochecker is an AI tutor + teacher-assistant platform built on the existing checker architecture.
- Existing flow remains operational: CLI, Telegram bot, dashboard, relay, YAML specs.
- New capabilities are active:
  - structured feedback fields in check outputs and reports
  - escalation by failed-attempt thresholds
  - deep diagnostics payload for escalated checks
  - teacher summary APIs for student/task/cohort views

## Current Evaluation Modes

- `spec_mode` (current default): behavior defined by `specs/*.yaml`.
- `llm_mode` (target): university-defined rubric/tasks via UI (planned; not default yet).

## Data and Multi-Tenant Direction

- Runtime DB is still SQLite by default.
- SQLite schema is tenant/role-ready (`tenant_id`, `role` columns).
- PostgreSQL migration target is prepared:
  - schema file: `db/postgres_schema.sql`
  - init script: `scripts/init_postgres.py`
  - data migration script: `scripts/migrate_sqlite_to_postgres.py`
- Target RBAC model:
  - `superadmin`
  - `university_admin`
  - `teacher`
  - `student`

## Teacher Assistant APIs (Implemented)

- `GET /api/teacher/summary/student/{github_alias}`
- `GET /api/teacher/summary/task?lab_id=...&task_id=...`
- `GET /api/teacher/summary/cohort?lab_id=...`

These APIs are tenant-aware via `tenant_id` query parameter.

## Escalation (Implemented Baseline)

- Escalation thresholds are read from check-level spec config.
- On repeated failures, checks transition through escalation states.
- Diagnostic payload is persisted in result details with:
  - root cause
  - evidence
  - recommended steps

## What Is Still Pending

- Full standalone diagnostic-agent orchestration (separate pipeline with richer VM/repo probing).
- Full dashboard UI integration for teacher-assistant summaries.
- Full PostgreSQL runtime cutover from SQLite.
- Beginner-track content and guided glossary flow.

## PostgreSQL Cutover (Step 1)

```bash
export DATABASE_URL='postgresql://user:pass@localhost:5432/autochecker'
export DEFAULT_TENANT_ID='default'
export DB_PATH='bot.db'

uv run python scripts/init_postgres.py
uv run python scripts/migrate_sqlite_to_postgres.py
```

After migration, validate row counts for `users`, `attempts`, `results`, `attempt_grants`.

Automated end-to-end cutover check:

```bash
bash scripts/e2e_pg_cutover.sh
```
