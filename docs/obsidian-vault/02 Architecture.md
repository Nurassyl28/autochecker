---
tags: [architecture]
---

# 02 Architecture

## High-level diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT HOST (Hetzner)                    │
│                                                                       │
│   ┌──────────────┐      ┌────────────────────┐    ┌───────────────┐  │
│   │ Telegram bot │      │ FastAPI dashboard  │    │ Sandbox runner│  │
│   │ main_bot.py  │      │ dashboard/app.py   │    │ (Docker       │  │
│   │              │      │                    │    │  ephemeral)   │  │
│   └──────┬───────┘      └──────┬─────────────┘    └──────┬────────┘  │
│          │                     │                          ▲          │
│          ▼                     │                          │          │
│   ┌────────────────────────────────────────────────────┐  │          │
│   │           autochecker.check_student()              │  │ spawned  │
│   │           (direct import — no subprocess)          │──┘          │
│   │                                                    │             │
│   │   CheckEngine  ──▶  GitHubClient / GitLabClient    │             │
│   │                ──▶  RepoReader (in-memory zip)     │             │
│   │                ──▶  LLM analyzer (OpenRouter)      │             │
│   │                ──▶  HTTP/SSH check dispatcher      │             │
│   │                                                    │             │
│   └────────────┬───────────────────┬───────────────────┘             │
│                │ SQLite (bot.db)   │                                 │
│                ▼                   ▼                                 │
│         ┌────────────┐     ┌───────────────┐                         │
│         │ bot-data   │     │ autochecker-  │                         │
│         │ (volume)   │     │ results       │                         │
│         └────────────┘     │ (volume)      │                         │
│                            └───────────────┘                         │
└──────────────────┬──────────────────┬─────────────────────────────────┘
                   │                  │
     WebSocket ◀───┘                  │  HTTPS / SSH (public IPs)
     (wss)                            │
                                      │
┌───────────── UNIVERSITY NETWORK ─────────────┐   ┌──── STUDENT VMs ────┐
│                                              │   │                     │
│  Relay worker (systemd, VM in 10.93.x.x/24)  │──▶│  10.x.x.x (internal)│
│  relay/worker.py                             │   │  and/or             │
│  receives SSH + HTTP jobs                    │   │  public IPs         │
│                                              │   │  (direct from bot)  │
└──────────────────────────────────────────────┘   └─────────────────────┘
```

## Request flow — student checks a task

```
Telegram user tap "Check"
  └─▶ bot/handlers/check.py  (callback handler; FSM may prompt for VM IP / LMS key)
        └─▶ bot/runner.py    (asyncio.run_in_executor → blocking check)
              └─▶ autochecker.check_student()
                    ├─ load LAB_CONFIG[lab_id]             ← autochecker/cli.py
                    ├─ load_spec(specs/<lab>.yaml)         ← autochecker/spec.py
                    ├─ create_client(platform, token)      ← autochecker/batch_processor.py
                    ├─ RepoReader(...).download()          ← zip via GitHub/GitLab
                    ├─ for each code check:
                    │     CheckEngine.run_check()          ← autochecker/engine.py
                    │        ├─ dispatch on check type
                    │        ├─ http_check / ssh_check → relay or direct
                    │        ├─ clone_and_run → Docker sandbox
                    │        └─ agent_eval → SSH into VM, run agent, grade
                    ├─ for each LLM check:
                    │     run_llm_check()                  ← autochecker/llm_analyzer.py
                    ├─ (if configured) analyze_repo()      ← deep LLM repo analysis
                    └─ Reporter writes JSONL + HTML + student_report.txt
        └─▶ save_result() to SQLite, increment attempts
  └─▶ Telegram sends student_report.txt + summary
```

## Key design decisions

### The bot imports the engine directly

Early versions spawned `autochecker` as a subprocess. The current design calls `check_student()` from `bot/runner.py` as a normal Python function (wrapped in `run_in_executor` to keep the event loop unblocked). This means:

- Real Python exceptions propagate instead of parsing stderr
- No disk I/O to pass results back
- Shared env vars and config
- One process to observe, one memory model

See `bot/runner.py` and `autochecker/__init__.py:check_student`.

### Specs drive behavior

Every check a lab runs is declared in `specs/<lab>.yaml`. Adding a new lab is a YAML file plus a three-line entry in `LAB_CONFIG` in `autochecker/cli.py`. Adding a new check type is a handler in `CheckEngine.run_check()` (~line 2330 of `engine.py`) plus a Pydantic field if it has new parameters.

See [[04 Lab Specs]] for the full format.

### Relay bridges the network gap

The deploy host lives outside the university network. Student VMs live inside 10.x.x.x subnets unreachable from the public internet. The relay worker is a thin WebSocket client running on a VM *inside* the subnet; when the dashboard needs an SSH or HTTP check done inside the network, it forwards the job over the open WebSocket.

- **Public-IP students** → direct SSH/HTTP from the bot container (no relay)
- **Internal-IP students** → job serialized over WebSocket → relay worker → student VM

See [[07 Relay & Network]].

### Sandbox isolates untrusted code

Some checks (`clone_and_run`, notably for `uv run poe test` in lab-02) execute student code. That runs inside an ephemeral Docker container built from `deploy/Dockerfile.sandbox`:

- 512 MB memory, 1 CPU, 256 PID limit
- All Linux capabilities dropped
- No access to bot env vars or database
- `--rm` so the container is destroyed after each run

See [[09 Deployment]] for the full restriction table.

## Component inventory

| Component | Path | Responsibility |
|-----------|------|----------------|
| Core engine | `autochecker/engine.py` (2832 lines) | Executes every check type |
| Entry point | `autochecker/__init__.py` — `check_student()` | Single programmatic API used by bot + CLI |
| Spec loader | `autochecker/spec.py` | Pydantic models, YAML load |
| Repo I/O | `autochecker/repo_reader.py` | Zip download + in-memory file lookup |
| GitHub API | `autochecker/github_client.py` | Repo info, commits, issues, PRs |
| GitLab API | `autochecker/gitlab_client.py` | Same API surface as GitHub client |
| LLM analysis | `autochecker/llm_analyzer.py` (661 lines) | OpenRouter calls for `llm_judge` and deep analysis |
| Report writer | `autochecker/reporter.py` | Produces `results.jsonl`, `summary.html`, `student_report.txt` |
| Batch runner | `autochecker/batch_processor.py` (543 lines) | Parallel cohort checks + plagiarism hook |
| Plagiarism | `autochecker/plagiarism_checker.py` (824 lines) | File similarity + git history signals |
| CLI | `autochecker/cli.py` + `main.py` | Typer commands: `check`, `batch`, `labs` |
| Bot core | `main_bot.py`, `bot/__init__.py` | aiogram Dispatcher + router setup |
| Bot DB | `bot/database.py` (677 lines) | SQLite schema, migrations, attempt accounting |
| Bot config | `bot/config.py` | Env vars, whitelist, per-lab active-task discovery |
| Bot auth | `bot/middlewares.py` | Per-request user load + whitelist eviction |
| Bot handlers | `bot/handlers/*.py` | `start`, `register`, `labs`, `check`, `qwen_auth` |
| Bot engine glue | `bot/runner.py` | `run_in_executor` wrapper around `check_student` |
| Dashboard | `dashboard/app.py` (1255 lines) | FastAPI routes + relay WebSocket + templates |
| Dashboard UI | `dashboard/templates/*.html` | `index.html`, `student.html`, `login.html` |
| Relay worker | `relay/worker.py` | WebSocket client that runs SSH + HTTP jobs |
| Sandbox image | `deploy/Dockerfile.sandbox` | Minimal Python 3.14 + git + uv |
| Verification | `verify.py` | 27 pre-deploy checks (structure, imports, CLI, specs) |

## Trust boundaries

| Trusted | Semi-trusted | Untrusted |
|---------|--------------|-----------|
| Instructor (dashboard password) | Student email in whitelist | Student code in sandbox |
| Bot container env (tokens, DB) | Student-provided VM IP | Student VM's running services |
| Relay worker (owns SSH key) | Student LMS API key | LLM outputs (validated, never executed) |

SSH private keys are never committed and never leave their respective hosts (relay VM or bot container). The dashboard's relay endpoints require an HMAC-verified bearer token.

## Related notes

- [[03 Check Engine]] — every check type, dispatch logic
- [[05 Telegram Bot]] — FSM states, handlers, attempt flow
- [[06 Dashboard]] — routes and relay endpoints
- [[07 Relay & Network]] — WebSocket protocol, IP routing
- [[09 Deployment]] — volumes, images, sandbox constraints
