---
tags: [deployment, docker, ops]
---

# 09 Deployment

Production runs on a single Hetzner host with Docker Compose. Three container roles:

1. **bot** — runs `main_bot.py`, handles Telegram traffic, executes checks
2. **dashboard** — runs `uvicorn dashboard.app:app`, handles HTTPS + relay WebSocket
3. **sandbox** — built-once image used by the bot to run `clone_and_run` student code

The sandbox is declared with `profiles: ["build-only"]` so it's built on `docker compose build` but not started as a long-running service — the bot spawns ephemeral instances with `docker run` as needed.

## Files

- `deploy/Dockerfile` — bot + dashboard image (Python 3.13-slim + Docker CLI + openssh-client + Node 22)
- `deploy/Dockerfile.sandbox` — sandbox image (Python 3.14-slim + git + uv + Node 22)
- `deploy/docker-compose.yml` — service definitions, volumes, env_file, mounts
- `deploy/update.sh` — pull, verify, rebuild, restart (what the operator runs on deploy)
- `deploy/.env.example` — template env file (copy to `deploy/.env`)

## Environment variables

Loaded from `deploy/.env` (referenced by `docker-compose.yml:env_file: .env`).

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GITHUB_TOKEN` | yes (if using GitHub) | — | Repo/issue/PR API access |
| `GITLAB_TOKEN` | yes (if using GitLab) | — | Same for GitLab |
| `OPENROUTER_API_KEY` | for LLM checks | — | OpenRouter API |
| `LLM_MODEL` | no | `google/gemini-2.5-flash-lite` | LLM model slug |
| `LLM_API_URL` | no | OpenRouter | Override LLM endpoint |
| `BOT_TOKEN` | yes | — | From @BotFather |
| `DB_PATH` | no | `bot.db` / `/app/data/bot.db` in prod | SQLite file |
| `ACTIVE_LABS` | no | `lab-01` | Comma-separated lab IDs shown in bot |
| `MAX_ATTEMPTS_PER_TASK` | no | `20` | Default attempt limit |
| `MAX_ATTEMPTS_EVAL_TASK` | no | `20` | Attempt limit for `agent_eval` tasks |
| `DASHBOARD_PASSWORD` | no | — (disables auth) | Instructor dashboard auth |
| `RELAY_TOKEN` | yes for relay | — | Shared secret with relay worker |
| `RELAY_URL` | worker-side | — | `wss://<dashboard>/relay/ws` |
| `SSH_KEY_PATH` | yes | `~/autochecker-ssh-key` (host) → `/app/ssh_key` (container) | SSH private key |
| `SANDBOX_DIR` | no | `/tmp/autochecker-sandbox` | Host temp dir for clone_and_run |

## Volumes and mounts

From `deploy/docker-compose.yml`:

| Mount | Container | Purpose |
|-------|-----------|---------|
| `bot-data` → `/app/data/` | bot, dashboard | SQLite `bot.db` |
| `autochecker-results` → `/app/results/` | bot | Per-student report files |
| `/var/run/docker.sock` → `/var/run/docker.sock` | bot | Lets the bot spawn sandbox containers |
| `/tmp/autochecker-sandbox` → `/tmp/autochecker-sandbox` | bot (shared with host) | `clone_and_run` repo checkouts, visible to sandbox mounts |
| `${SSH_KEY_PATH}` → `/app/ssh_key:ro` | bot | SSH private key |

Port mapping for dashboard: `127.0.0.1:8082:8000`. The dashboard is reverse-proxied (nginx/Caddy) to add TLS externally.

## Sandbox restrictions

`clone_and_run` checks run in ephemeral Docker containers spawned by the bot. Restrictions applied at `docker run` time:

| Resource | Limit |
|----------|-------|
| RAM | 512 MB (`--memory=512m`) |
| CPU | 1 core (`--cpus=1`) |
| Processes | 256 (`--pids-limit=256`) |
| Linux capabilities | all dropped (`--cap-drop=ALL`) |
| Privilege escalation | blocked (`--security-opt=no-new-privileges`) |
| Filesystem | only the cloned repo directory is mounted |
| Bot env vars | not accessible (separate container) |
| Bot database | not accessible |
| Network | allowed (needed for `uv sync` to install deps) |
| Lifecycle | `--rm` so container is destroyed after each run |

If Docker isn't available (local dev), the fallback is a plain `subprocess.run` with no isolation.

## Deploying

The operator workflow is `deploy/update.sh`:

```bash
cd ~/autochecker
./deploy/update.sh
```

Which does:

1. `git pull`
2. Build a verification image and run `verify.py` inside it (27 structure/import/CLI/spec checks)
3. Migrate the results volume if it's still at the old mount path (one-time shim)
4. `docker compose -f deploy/docker-compose.yml build`
5. `docker compose -f deploy/docker-compose.yml up -d`
6. `docker compose ps` to confirm both services are up

**Gotcha:** `docker compose up -d` alone reuses old images. Always build first. `update.sh` handles this.

## Verifying locally before deploy

```bash
uv run python verify.py
```

27 checks across:

- **Structure** — all packages, entry points, deploy files exist
- **Imports** — every module imports cleanly, key attributes are exposed
- **Path resolution** — `ROOT_DIR`, `SPECS_DIR`, `RESULTS_DIR` point to real places; no stale references to the old `AUTOCHECKER_DIR`
- **CLI smoke tests** — `python main.py --help`, `python main.py labs`, `python -m autochecker --help`
- **Spec loading** — lab-01 and lab-02 load; extended spec fields validate
- **Docker** — Dockerfile has expected markers; docker-compose has correct volumes

All must PASS before `update.sh` proceeds (it runs `verify.py` inside a fresh container).

## Relay worker deployment

Separate from the deploy host — manually `scp`ed to the university VM and run as a systemd service. See [[07 Relay & Network]] § Deploying the relay.

Stdout truncation limit (`65536`) is set in `relay/worker.py`; if it's ever changed, remember to redeploy the relay.

## Local development

```bash
uv venv
uv pip install -r requirements.txt
cp .env.example .env
# fill in tokens

uv run python main.py check -s <alias> -l lab-01 -p github      # single check
uv run python main.py batch -s students.csv -l lab-01 -p github # batch
uv run python main_bot.py                                       # bot
uv run uvicorn dashboard.app:app --port 8000                    # dashboard
```

Tests:

```bash
uv run pytest tests/test_agent_eval.py -v
```

Right now the test suite focuses on agent eval. Spec loading and structured feedback are exercised by `verify.py`.

## Secrets hygiene

- SSH private key: lives on host at `~/autochecker-ssh-key` (0600). Mounted read-only into the bot container. Never committed.
- `.env`: not tracked. `.env.example` is the template.
- Tokens: kept in `.env` only. Rotation means editing `.env` and `docker compose up -d` (no rebuild needed because the env file is re-read at container start).
- Student LMS keys: stored in SQLite, per-user. Reset via the dashboard edit form or `scripts/reset_attempts.py`.

## Related notes

- [[02 Architecture]] — containers in context
- [[07 Relay & Network]] — relay worker deployment (separate)
- [[08 Data Model]] — `bot-data` volume contents
- [[13 Gotchas]] — `docker compose up` without build, CRLF in env files
