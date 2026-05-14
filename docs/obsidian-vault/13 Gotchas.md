---
tags: [gotchas, bugs, operations]
---

# 13 Gotchas

Recurring bugs, surprising fixes, and things worth knowing before touching the system. Keep this note short by habit — long-form analysis belongs in `docs/gotchas.md` (which this summarizes).

## Shell and data integrity

### Scope every DELETE on `attempts` / `results` / `attempt_grants` by both `lab_id` AND `task_id`

A `DELETE FROM results WHERE task_id = 'task-3'` missing the `lab_id` clause wiped lab-05 task-3 completions along with lab-06 task-3 attempts. No recovery. Always:

```sql
DELETE FROM results WHERE lab_id = 'lab-06' AND task_id = 'task-3';
```

### CRLF in `.env.agent.secret` breaks `source`

Students on Windows end up with `\r` at end of every line. Bash `source` reads `LLM_API_BASE_URL=https:\r` and the next line becomes a bare shell command. Fix in the agent launcher:

```bash
# WRONG
set -a && source .env.agent.secret && set +a

# CORRECT
set -a && . <(tr -d '\r' < .env.agent.secret) && set +a
```

### Rename safety

Before saving a rename, `grep -n 'old_name'` in the file to confirm zero occurrences left. A missed `{ip}` in an f-string once crashed the entire IP-save flow with `NameError`.

## Relay and networking

### Never clear `_relay_worker = None` on a per-job timeout

One slow SSH job used to `except asyncio.TimeoutError: _relay_worker = None`, which bricked all subsequent relay traffic even though the WebSocket was alive. Only clear the worker reference on actual WebSocket exceptions from `ws.send_json`. Timeouts return 504; they don't kill the worker.

### Process relay jobs concurrently, not sequentially

Serial `await loop.run_in_executor(...)` inside `async for raw in ws` blocks the message loop. Use `asyncio.create_task(_handle_job(ws, job))` so 10+ concurrent students don't cascade into timeouts.

### Health-check cron: test real SSH, not `/relay/status`

`/relay/status` was unreliable as a liveness probe. A cron that restarted the worker on a "false" status caused an infinite restart loop. Use a real SSH job to test end-to-end:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"host":"$RELAY_VM_IP","port":22,"username":"deploy","command":"echo ok","timeout":5}' \
  $DASHBOARD_URL/relay/ssh | grep '"exit_code":0'
```

### Truncate stdout from the start, not the end

Agent-eval JSON lives at the *top* of stdout. Tail-truncation (`stdout[-4096:]`) drops the opening `{` and grading fails. Always:

```python
result.stdout[:65536]
```

Also cap what gets sent to the LLM inside the agent: `content: result[:15000]` to avoid filling context with large API payloads.

### Strip tool results from agent JSON output

Include `{"tool": name, "args": args}` only — never the result text. Otherwise output exceeds the relay's 64 KB cap.

### Relay only reaches its own subnet

Worker on `10.93.x.x` can't reach students on `10.90.x.x`. For those students, mark the deployment check done manually via the dashboard or SQL — there's no single-relay fix.

### Public IPs must go direct, not through relay

The relay rejects any URL/host not matching `10.x`, `172.16-31.x`, `192.168.x`. Routing a public IP through it returns a 200 with an error body, which is not obvious. Engine routing:

```python
if not host.startswith("10."):
    return self._direct_ssh(host, port, username, command, timeout)
```

### Relay worker is NOT auto-deployed

Manually `scp` `relay/worker.py` to the university VM and `systemctl restart relay-worker` after any change.

## Bot and Telegram

### Catch `TelegramBadRequest` on `edit_message_text`

Double-tap of the same button → "message not modified" → unhandled exception → aiogram queue backs up → bot goes silent (one update once took 19 minutes to process). Every `edit_text` needs:

```python
try:
    await callback.message.edit_text("...", reply_markup=keyboard)
except TelegramBadRequest:
    pass
```

### `agent_eval` tasks need `server_ip` even without `runtime: prod`

`get_tasks_needing_ip()` only returns tasks whose checks have `params.runtime: prod`. An `agent_eval` check has no `runtime: prod` but still needs the VM IP. Fix in `bot/handlers/check.py`:

```python
if task_id in get_tasks_needing_ip(lab_id) or task_id in get_tasks_needing_lms_key(lab_id):
    server_ip = await get_server_ip(db_user.tg_id)
```

Without this, every lab-06 task-3 check silently ran without an IP and failed.

## Engine quirks

### `/issues` returns PRs too

GitHub's `GET /repos/:o/:r/issues` includes pull requests. When a PR shares a title with an issue, an `issue_exists`-style check matched the PR, then the "does a PR close this issue?" check looked for a PR closing the PR number — always nothing. Filter in `get_issues()`:

```python
all_items = self._get("issues?state=all&per_page=100") or []
return [i for i in all_items if "pull_request" not in i]
```

### Numeric regex `[\d.]+` matches lone dots

`[\d.]+` greedily matches a single `.` (from sentence-ending punctuation) and `float('.')` crashes. Use:

```python
numbers = re.findall(r"\d+(?:\.\d+)?", text)
```

### Qwen proxy HOST_PORT vs internal PORT

`qwen-code-oai-proxy` maps `HOST_PORT:8080` in Docker. From the host, the proxy is on `HOST_PORT` (e.g. `42005`), not `8080`. Students' `.env.agent.secret` must use the host port.

## Database and frameworks

### PostgreSQL `round(x, n)` needs `Numeric`

SQLAlchemy's `func.avg()` returns `double precision`, which PostgreSQL's two-arg `round()` doesn't accept:

```python
from sqlalchemy import cast, func, Numeric
func.round(cast(func.avg(col), Numeric), 1)  # correct
```

### Student VM: root SSH fails if `/root` is world-writable

OpenSSH refuses key auth if `$HOME` is 777. Fix on the student VM: `chmod 755 /root`.

Checklist when debugging student SSH: `vm_username` in DB, key match, `.ssh` 700, `authorized_keys` 600, home dir not 777, `PermitRootLogin` in `sshd_config`.

## Deployment

### Always `docker compose build` before `up -d`

`docker compose up -d` alone reuses the old image. `deploy/update.sh` always builds first. If you forget and a feature doesn't show up, build.

### Relay worker stdout limit is manual

`relay/worker.py` caps stdout at 65536. Not auto-deployed. Redeploy manually on any change.

## Longer write-ups

The full versions of these gotchas (with dates, symptoms, incident notes) live in `docs/gotchas.md`. This note is the short reference.

## Related notes

- [[07 Relay & Network]] — relay mechanics these gotchas touch
- [[05 Telegram Bot]] — bot-side crash modes
- [[08 Data Model]] — DELETE scoping rule
- [[09 Deployment]] — build-before-up rule
