---
tags: [dashboard, fastapi]
---

# 06 Dashboard

The dashboard is the instructor-facing surface. It lists students, shows their per-task status, lets instructors edit settings, grant extra attempts, and export CSVs. It also hosts the relay WebSocket that the check engine uses to reach internal student VMs.

Entry point: `dashboard/app.py` (1255 lines). Framework: FastAPI. Templates: Jinja2 (`dashboard/templates/*.html`). Port inside the container: `8000`. Exposed on the host as `127.0.0.1:8082`.

## Auth

Simple password auth with an HMAC-signed cookie:

- `DASHBOARD_PASSWORD` env var is the shared secret
- `/login` renders a form; `POST /login` verifies the password (`hmac.compare_digest`) and sets the `dash_auth` cookie
- The cookie value is `HMAC-SHA256(password, "authenticated")` — re-verified on every request
- Cookie lives for 30 days, `httponly`, `samesite=lax`
- If `DASHBOARD_PASSWORD` is empty, auth is disabled (dev mode)

Routes that are always public despite the middleware: `/login`, `/relay/*`, `/api/*` (these have their own auth mechanism).

## Routes

Defined with FastAPI decorators in `dashboard/app.py`.

### Instructor-facing pages

| Method | Path | Template | Purpose |
|--------|------|----------|---------|
| GET | `/login` | `login.html` | Password form |
| POST | `/login` | — | Set auth cookie |
| GET | `/` | `index.html` | Dashboard home: grid of students × tasks with scores |
| GET | `/student/{alias}` | `student.html` | Per-student detail: settings, attempts, per-task results |

### Student-row actions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/student/{alias}/edit` | Update email, group, VM IP, VM username, LMS key, admin flag |
| POST | `/student/{alias}/attempts/free` | Grant extra attempts for a task (written to `attempt_grants`) |
| POST | `/student/{alias}/mark-done` | Manually mark a task as completed (e.g. when relay can't reach VM) |
| POST | `/student/{alias}/revert-done` | Undo a manual completion |

### Exports and APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/export/csv` | Export scores as CSV |
| GET | `/api/items` | Lab-05-style demo API used by student apps |
| GET | `/api/logs` | API access log (for lab-05/lab-06 observability) |
| GET | `/api/access-log/{alias}` | Per-student API access log |
| GET | `/api/eval/question` | Serve eval questions for lab-06 `run_eval.py` |

### Relay endpoints

| Method | Path | Purpose |
|--------|------|---------|
| WS | `/relay/ws` | WebSocket endpoint — the relay worker connects here |
| POST | `/relay/check` | HTTP check job (forwarded to relay worker) |
| POST | `/relay/ssh` | SSH check job (forwarded to relay worker) |
| GET | `/relay/status` | `{"worker_connected": bool}` |

All relay endpoints require `Authorization: Bearer <RELAY_TOKEN>`.

## Relay protocol (dashboard side)

The dashboard holds exactly one `WebSocket` reference to the connected relay worker (`_relay_worker: Optional[WebSocket]`). Jobs are tracked in a dict:

```python
_relay_jobs: dict[str, asyncio.Future] = {}
```

When the engine POSTs to `/relay/check` or `/relay/ssh`:

1. The route creates a `job_id = uuid.uuid4()`, registers an `asyncio.Future`, and `send_json`s the job over the WebSocket
2. It `await`s the future with a timeout (~12 s for first attempt, retry once on stale connection)
3. The relay worker executes the job and sends back a JSON result tagged with the same `job_id`
4. The `/relay/ws` read loop resolves the matching future
5. The route serializes the future result to the engine

**Gotcha** (see [[13 Gotchas]]): timeouts must not clear `_relay_worker = None`. One slow SSH job used to brick all subsequent relay traffic until reconnect. The fix is to only clear the reference on actual WebSocket exceptions, never on per-job timeout.

## Index page

`index.html` renders a grid: rows are students, columns are (lab, task). Each cell shows the latest score and color-codes by pass threshold. Cells are clickable, leading to `/student/{alias}` where the full history is visible.

The task list is discovered at request time from `specs/lab-*.yaml` (combining `ACTIVE_LABS` with any spec on disk), so adding a new lab spec is reflected as soon as the container reloads. Max-attempt limits are attached per-task based on whether the task is `agent_eval`-style.

## Student page

`student.html` shows:

- Editable fields (email, group, VM IP, VM username, LMS key, admin flag)
- Per-lab attempt counts and effective attempt limit
- "Grant attempts" form (lab + task + amount + reason)
- "Mark as done" / "Revert done" buttons
- API access log (recent calls to `/api/items` etc. using the student's LMS key)

All edits go through POST endpoints that update SQLite directly (no migrations at runtime — this is a server-side admin surface).

## Dashboard-owned tables

The dashboard ensures two tables exist on startup regardless of what the bot has migrated:

- `api_access_log` (email, endpoint, timestamp) — used by lab-05/06 API routes to log student requests
- `attempt_grants` (tg_id, lab_id, task_id, amount, reason, timestamp) — mirrors the bot's schema v8 migration

See [[08 Data Model]] for full schema.

## Attempt granting vs attempt reset

Two different ways to give a student more tries:

- **Grant** (preferred) — `POST /student/{alias}/attempts/free` writes a positive amount to `attempt_grants`. The base limit + grants − used = remaining. History is preserved.
- **Reset** — via the CLI script `scripts/reset_attempts.py` or manual SQL `DELETE FROM attempts WHERE lab_id = ... AND task_id = ...`. **Always** scope by both `lab_id` and `task_id` — the "DELETE nuked lab-05 task-3" incident is documented in [[13 Gotchas]].

## Related notes

- [[07 Relay & Network]] — full relay WebSocket protocol
- [[08 Data Model]] — tables the dashboard reads and writes
- [[09 Deployment]] — Docker-compose service, port mapping, env vars
- [[13 Gotchas]] — timeouts, DELETE scoping, health-check loops
