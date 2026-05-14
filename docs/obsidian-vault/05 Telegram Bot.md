---
tags: [bot, telegram, aiogram]
---

# 05 Telegram Bot

The Telegram bot is the student-facing surface. Students register once, then select a lab → select a task → tap **Check**. The bot runs the lab's YAML spec against their repo and returns a plain-text report.

Entry point: `main_bot.py`. Package: `bot/`. Framework: aiogram 3.x.

## Dispatch and middleware

`main_bot.py` builds a single `Dispatcher`, attaches `AuthMiddleware` as an outer middleware on both messages and callbacks, and includes routers in a specific order:

```python
dp.message.outer_middleware(AuthMiddleware())
dp.callback_query.outer_middleware(AuthMiddleware())

dp.include_router(check.router)     # FSM states (waiting_for_server_ip, etc.)
dp.include_router(qwen_auth.router)
dp.include_router(register.router)  # handles unregistered users
dp.include_router(labs.router)
dp.include_router(start.router)     # catch-all
```

Order matters. The check router must run first so in-flight FSM states (for example, a user who is currently entering their VM IP) are not swallowed by the `/start` catch-all.

## Auth middleware

`bot/middlewares.py:AuthMiddleware` loads the user from SQLite on every event and injects them as `db_user` into handler kwargs (`None` if unregistered).

It also **evicts** any registered user whose email is no longer in `ALLOWED_EMAILS` (unless they are an admin), by calling `delete_user()`. This means removing a row from `bot/allowed_emails.csv` and redeploying immediately kicks the student out of the system.

## Whitelist

Only emails listed in `bot/allowed_emails.csv` can register. The CSV has two columns: `email,group`. Loaded at import time by `bot/config.py` into `ALLOWED_EMAILS: dict[str, str]` mapping email to group.

- If `bot/allowed_emails.csv` is missing, the bot falls back to `bot/allowed_emails.txt` (one email per line, no group)
- If both are missing, `ALLOWED_EMAILS` is empty and nobody can register
- New registrations: blocked at the email step if not whitelisted; group auto-assigned from CSV
- Existing users: evicted on next interaction if their email isn't in the list
- On every startup, `init_db()` backfills `users.student_group` from the CSV for existing rows
- Admins (`is_admin = 1`) are exempt from the whitelist

## Handlers at a glance

| Handler | Path | Purpose |
|---------|------|---------|
| `start` | `bot/handlers/start.py` | `/start`, welcome, route to register or labs |
| `register` | `bot/handlers/register.py` | FSM: ask email → verify whitelist → ask GitHub alias → save user |
| `labs` | `bot/handlers/labs.py` | Render inline keyboard of active labs |
| `check` | `bot/handlers/check.py` | Render task menu, run check, handle FSM prompts |
| `qwen_auth` | `bot/handlers/qwen_auth.py` | OAuth-style flow for Qwen proxy used in lab-06 |

## Check flow

When a student taps a task in the labs keyboard, `check.py` handles the callback. For a typical task:

1. Verify the user is registered and load `db_user`
2. Look up attempt count for `(tg_id, lab_id, task_id)` and compare to the effective limit
3. If the task needs runtime information (server IP, VM username, LMS API key), prompt for whatever is missing via FSM
4. Call `bot/runner.py:run_check()` which wraps `check_student` in an executor
5. Persist the result to SQLite (`save_result`), increment `attempts`
6. Send the text report back as a message; attach `student_report.txt` if large

The three FSM states live in `bot/handlers/check.py`:

```python
class CheckStates(StatesGroup):
    waiting_for_server_ip = State()
    waiting_for_vm_username = State()
    waiting_for_lms_key = State()
```

A task that needs any of these triggers the corresponding state; the answer is saved to the user row in SQLite and re-used on subsequent checks.

### VM IP prompting

A task "needs the server IP" when at least one of its checks has `params.runtime: prod` *or* the task appears in `get_tasks_needing_lms_key()` (because `agent_eval` uses SSH implicitly; this was a recurring gotcha — see [[13 Gotchas]]).

Before saving a new IP, the bot checks whether the VM is reachable via the relay (`_check_vm_reachable_sync`). If the relay is offline the check is skipped rather than blocking the student.

## Commands

Only two commands are registered with Telegram's menu:

| Command | Description |
|---------|-------------|
| `/start` | Main entry — shows registration or labs menu |
| `/reset` | Show and reset stored settings (VM IP, VM username, LMS key) |

## Execution wrapping

`bot/runner.py` wraps `check_student` in `asyncio.run_in_executor` with a hard timeout (`EXECUTION_TIMEOUT = 1200` seconds):

```python
result = await asyncio.wait_for(
    loop.run_in_executor(None, functools.partial(_run_check_sync, ...)),
    timeout=EXECUTION_TIMEOUT,
)
```

This keeps the event loop free for concurrent students, bounds runtime for runaway checks, and returns a uniform `CheckResult` dataclass regardless of internal failure mode.

## Attempt accounting

Attempts are tracked per `(tg_id, lab_id, task_id)` in the `attempts` table. Instructors can grant extra attempts without deleting history via the `attempt_grants` table (added in schema v8). See [[08 Data Model]].

The effective attempt limit is:

```
base_limit (MAX_ATTEMPTS_PER_TASK or MAX_ATTEMPTS_EVAL_TASK)
  + sum(attempt_grants.amount for that student + lab + task)
  - count(attempts for that student + lab + task)
```

Eval tasks (anything driven by `agent_eval` or the lab's `requires_lms_key: true`) use the `_EVAL_TASK` limit, which can be set lower because those checks are expensive.

## Message-edit crash protection

When students tap the same button twice, Telegram rejects the second `edit_message_text` as "message is not modified". If not caught, the unhandled `TelegramBadRequest` can back up aiogram's queue and the bot appears frozen. All edit calls are wrapped:

```python
try:
    await callback.message.edit_text("...", reply_markup=keyboard)
except TelegramBadRequest:
    pass
```

See [[13 Gotchas]] for the incident history.

## Report rendering

The bot converts `summary.html` to a Telegram-friendly plain-text message using `_parse_summary_html`, which:

- Adds newlines before block-level tags
- Strips the remaining tags
- Collapses repeated blank lines

If the parsed text is too large for a single Telegram message, the bot sends `student_report.txt` as a file attachment via `FSInputFile`.

## Related notes

- [[03 Check Engine]] — what the bot is running under the hood
- [[08 Data Model]] — attempts, results, grants, user settings
- [[07 Relay & Network]] — how the bot reaches internal student VMs
- [[13 Gotchas]] — crash modes and fixes
