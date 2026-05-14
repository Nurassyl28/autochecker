---
tags: [index, autochecker]
---

# Autochecker — Obsidian Documentation Vault

This vault is the project encyclopedia for **autochecker**, an automated lab-checking platform built for a university software-engineering course. It is actively being upgraded into an AI tutor for students and an AI teacher-assistant for instructors.

Drop the whole `obsidian-vault/` folder into Obsidian as a vault, or open this file directly to navigate.

## Start here

- [[01 Overview]] — what autochecker is, who it serves, how the pieces fit
- [[02 Architecture]] — end-to-end request flow and component diagram
- [[11 Product Roadmap]] — where the project is going (AI tutor + TA)

## Platform reference

- [[03 Check Engine]] — the core `autochecker/` package
- [[04 Lab Specs]] — YAML spec format and every available check type
- [[05 Telegram Bot]] — aiogram bot, handlers, and FSM flow
- [[06 Dashboard]] — FastAPI instructor dashboard
- [[07 Relay & Network]] — relay worker, SSH routing, internal-IP access
- [[08 Data Model]] — SQLite schema and migrations

## Operations

- [[09 Deployment]] — Docker, environment variables, SSH key setup
- [[10 Plagiarism Detection]] — batch analysis and investigation pipeline
- [[13 Gotchas]] — recurring bugs and surprising fixes

## Team & glossary

- [[12 Team Structure]] — backend+AI / frontend+UI/UX subteams
- [[14 Glossary]] — terms and acronyms

## Canonical source files

| Topic | File |
|-------|------|
| Core check engine | `autochecker/engine.py` |
| LLM analysis | `autochecker/llm_analyzer.py` |
| YAML spec model | `autochecker/spec.py` |
| Student entry point | `autochecker/__init__.py` → `check_student()` |
| CLI | `autochecker/cli.py`, `main.py` |
| Telegram bot | `bot/`, `main_bot.py` |
| Dashboard | `dashboard/app.py` |
| Relay worker | `relay/worker.py` |
| Lab YAML specs | `specs/*.yaml` |
| Pre-deploy verification | `verify.py` |
| Deploy | `deploy/Dockerfile`, `deploy/docker-compose.yml`, `deploy/update.sh` |
| Product brief | `AGENTS.md`, `spec/*.md` |

## How to keep this vault accurate

This vault is a snapshot. When something changes structurally (new check type, new subsystem, schema migration, new deployment step), update the relevant note. The sections to update first after any refactor:

- New check type → [[04 Lab Specs]]
- New DB column or table → [[08 Data Model]]
- Routing change (relay, SSH, HTTP) → [[07 Relay & Network]]
- New env var → [[09 Deployment]]
