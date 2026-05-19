---
tags: [overview, autochecker]
---

# 01 Overview

## What is autochecker

Autochecker is an automated lab-checking platform that evaluates student repositories against lab specifications written in YAML. Students interact with it through a Telegram bot; instructors monitor and manage it through a web dashboard; the engine talks to GitHub, GitLab, and student-owned virtual machines.

It is used in a real university course today, not a prototype.

## What it does, end to end

1. A student forks a lab repository, does the work, and pushes their changes.
2. The student opens the Telegram bot, picks a lab and a task, and taps **Check**.
3. The bot downloads the student's repo as a zip, loads the lab's YAML spec, and runs every check declared for that task.
4. Some checks are pure code reads (file exists, markdown section has headings, commit message matches regex). Others hit APIs (GitHub issues and pull requests), call an LLM to grade written work, clone the repo into a Docker sandbox to run tests, or SSH into the student's own VM to verify a deployment.
5. The engine produces a structured result: score, per-check PASS/FAIL/ERROR, and human-readable hints.
6. The bot sends back a student-facing report. The dashboard aggregates everything for the instructor.

## Who it serves

- **Students** — today a pass/fail grader with hints; being upgraded into an AI tutor that explains *why* a check failed and *what to do next*.
- **Instructors** — today a dashboard of who passed what; being upgraded into an AI teacher-assistant with cohort analytics, failure clustering, and intervention suggestions.
- **Course operators** — spec-driven authoring means adding a lab is a YAML file + a one-line CLI registration, not custom code.

## The four surfaces

| Surface | Entry point | Purpose |
|---------|-------------|---------|
| CLI | `main.py` (Typer) | Instructor-run checks; `check` for one student, `batch` for a cohort |
| Telegram bot | `main_bot.py` (aiogram 3.x) | Student self-service checks |
| Dashboard | `dashboard/app.py` (FastAPI) | Instructor view of progress, edits, attempt management |
| Relay worker | `relay/worker.py` | Thin agent on the university network that executes jobs the bot can't reach directly |

All four share the same check engine in `autochecker/`. See [[02 Architecture]] for the full picture.

## Tech stack

- **Language:** Python 3.13 (bot, dashboard, engine); Python 3.14 inside the sandbox image
- **Package manager:** `uv` — the default local developer workflow
- **CLI:** Typer
- **Web:** FastAPI + Jinja2 templates + uvicorn
- **Bot:** aiogram 3.x
- **DB:** SQLite via aiosqlite (single file, migrated in-place)
- **Validation:** Pydantic
- **LLM:** OpenRouter (default model `google/gemini-2.5-flash-lite`)
- **Specs:** YAML, parsed by `autochecker/spec.py`
- **Repo access:** GitHub REST API, GitLab REST API, direct zip archive download
- **Remote execution:** WebSocket relay + `ssh` + `curl` + Docker for sandboxed code runs

## Repository layout

```
autochecker/                # repo root
├── autochecker/            # core check engine (pure Python package)
├── bot/                    # Telegram bot (aiogram)
├── dashboard/              # FastAPI instructor dashboard
├── relay/                  # WebSocket worker for internal-network jobs
├── specs/                  # YAML lab specifications (lab-01.yaml ... lab-08.yaml)
├── spec/                   # Product spec documents (project direction, subteams)
├── scripts/                # Utility scripts (plagiarism investigation, attempt reset)
├── tests/                  # Pytest suite (currently agent-eval focused)
├── deploy/                 # Dockerfile, docker-compose, update.sh
├── docs/                   # Internal documentation
├── main.py                 # CLI entry point
├── main_bot.py             # Bot entry point
├── verify.py               # 27-check pre-deploy verification
├── AGENTS.md               # Project brief and rules
├── README.md
└── CONTRIBUTING.md
```

## Current scope and scale

- **Labs shipped:** lab-01 through lab-08 (plus lab-06-eval)
- **Active labs** are controlled by the `ACTIVE_LABS` env var, so the bot only exposes what the instructor has turned on
- **Plagiarism detection** is a first-class part of the batch workflow
- **Sandbox runs** (for `clone_and_run` checks) execute in ephemeral Docker containers with memory/CPU limits and dropped Linux capabilities
- **Attempt limits** per student per task are enforced by the bot (configurable)

## Product direction in one sentence

Extend — don't replace — the current autochecker so students experience an AI tutor and instructors experience an AI teaching assistant, using the same spec-driven foundation. See [[11 Product Roadmap]] for detail.

## Related notes

- [[02 Architecture]] — the full system diagram
- [[03 Check Engine]] — how `check_student()` runs
- [[11 Product Roadmap]] — where it's headed
- [[12 Team Structure]] — who owns what
