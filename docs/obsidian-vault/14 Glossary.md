---
tags: [glossary]
---

# 14 Glossary

Domain and project-specific terms used across the codebase and the vault.

## Platform

**Autochecker** — the system this vault documents. Spec-driven lab checker + Telegram bot + instructor dashboard + network relay.

**Lab** — a single graded assignment (e.g. lab-03). Defined by a YAML file in `specs/`.

**Spec** — the YAML file declaring a lab's tasks, checks, scoring, and runtime. Loaded by `autochecker/spec.py`.

**Task** — a group of checks within a lab (e.g. `task-1`, `setup`, `workflow`). Students check one task at a time.

**Check** — a single verifiable rule (e.g. "file exists", "issue matches pattern", "agent passes this eval set"). Has a type, params, hint, optional weight.

**Check type** — the dispatch key used by `CheckEngine.run_check`. About 30 types exist; see [[03 Check Engine]].

**Runner** — a check-level field distinguishing `code` (handled by `engine.py`) from `llm` (handled by `llm_analyzer.py`).

**Structured feedback** — the (future) Pydantic-typed result shape: `status`, `short_reason`, `detailed_reason`, `likely_cause`, `next_steps`, `hint`, `escalation_state`. See [[11 Product Roadmap]].

**Escalation** — the (future) process of triggering a deeper diagnostic flow after repeated failed attempts on the same check.

## Infrastructure

**Deploy host** — the public-internet VM (Hetzner) running bot + dashboard Docker containers.

**Relay worker** — a thin Python process running as a systemd service on a VM inside the university network. Executes SSH and HTTP jobs that the deploy host can't reach directly.

**Sandbox** — an ephemeral Docker container spawned by the bot to run student code for `clone_and_run` checks. Image: `autochecker-sandbox:latest` built from `deploy/Dockerfile.sandbox`.

**Student VM** — a virtual machine owned by the student, typically on the university's 10.x.x.x network, that hosts their deployed lab services.

## People

**Student** — a registered user who submits checks via the Telegram bot.

**Instructor** — an admin user of the dashboard; can grant attempts, mark tasks done, edit student settings.

**Admin** — any `users.is_admin = 1` row. Exempt from whitelist eviction.

**TA** — teaching assistant; uses the dashboard and flags cases for manual review.

## Processes

**Check attempt** — one run of a single task's checks for one student. Logged in the `attempts` table; counted against the attempt limit.

**Attempt grant** — an instructor-awarded extra attempt; recorded in `attempt_grants`. Preserves history.

**Batch check** — instructor-driven `main.py batch` run; produces per-student reports + plagiarism analysis.

**Agent eval** — a check type used in lab-06 that SSH's into the student VM, runs a student-built agent against a question set, and grades the output with keyword rules + LLM judging. See `docs/lab-06-eval-reference.md`.

**Escalation triggered** — state where repeated failures have caused the (future) diagnostic-agent layer to engage.

## Artifacts

**`results.jsonl`** — JSON-lines file with one summary object and one result per check. Primary machine-readable output.

**`summary.html`** — instructor-facing HTML report including LLM analysis section.

**`student_report.txt`** — plain-text student-facing report.

**`bot.db`** — the single SQLite database. Mounted at `/app/data/bot.db` in production.

**`plagiarism_report.json`** / **`git_plagiarism_flags.json`** — outputs of batch plagiarism analysis. See [[10 Plagiarism Detection]].

## Product framing

**AI tutor mode** — target student-facing experience: structured explanations, next-step recommendations, escalation.

**AI teacher-assistant mode** — target instructor-facing experience: cohort summaries, failure clustering, intervention suggestions.

**Beginner track** — future, simpler-language variant of labs for non-technical learners.

## Acronyms

- **FSM** — finite state machine (aiogram's conversation-state system)
- **LMS** — learning-management system (Moodle in this course)
- **LMS_API_KEY** — per-student key that lets their code hit the dashboard's API during eval-style checks
- **MD5** — hash function used for plagiarism file comparison
- **SSH** — secure shell, used for relay and direct VM checks
- **VM** — virtual machine
- **WS / WSS** — WebSocket / WebSocket over TLS, used for relay protocol
- **HMAC** — hash-based message authentication code, used for dashboard cookie signing
- **OpenRouter** — LLM API aggregator the analyzer calls by default

## Related notes

- [[01 Overview]] — everyday usage of these terms
- [[03 Check Engine]] — deeper definitions of check-type, runner
- [[11 Product Roadmap]] — tutor/TA framing
