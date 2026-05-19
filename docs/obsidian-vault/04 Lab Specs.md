---
tags: [specs, yaml]
---

# 04 Lab Specs

Every lab is defined by a single YAML file in `specs/`. The file declares:

- lab identity and repo name
- task groups (used by the bot menu)
- scoring rules
- runtime configuration (e.g. VM port mapping)
- the list of checks with their parameters, hints, weights, and (optionally) tutoring and escalation metadata

Specs are loaded by `autochecker/spec.py:load_spec()` and validated against Pydantic models. Unknown top-level fields are ignored to allow forward-compatibility.

## Current labs

| Spec | Title |
|------|-------|
| `lab-01.yaml` | Products, Architecture & Roles |
| `lab-02.yaml` | Run, Fix, and Deploy a Backend Service |
| `lab-03.yaml` | Backend API: Explore, Debug, Implement, Deploy |
| `lab-04.yaml` | Testing, Front-end, and AI Agents |
| `lab-05.yaml` | Data Pipeline and Analytics Dashboard |
| `lab-06.yaml` | Build Your Own Agent |
| `lab-06-eval.yaml` | Companion eval set for lab-06 agent grading |
| `lab-07.yaml` | Build a Client with an AI Coding Agent |
| `lab-08.yaml` | The Agent is the Interface |

Activation is controlled separately by the `ACTIVE_LABS` env var on the deploy host. The bot only shows labs in that list.

## Top-level structure

```yaml
id: lab-03
title: "Lab 03 — Backend API: Explore, Debug, Implement, Deploy"
repo_name: "se-toolkit-lab-3"

discovery:
  mode: "alias_repo_name"
  default_branch: "main"

scoring:
  mode: "weighted"
  pass_threshold: 0.75
  score_required_only: true

runtime:
  prod:
    base_url: "http://{server_ip}:42002"

# Optional: top-level toggles
requires_lms_key: false        # true = all tasks need student LMS key

# Optional: tutor/teacher metadata (future direction — see roadmap)
learning_objectives:
  - "Understand REST API design"
teacher_summary:
  category: "backend"
  tags: ["api", "deployment"]
  summary_template: "Backend API skill focus"
  intervention_hints: ["Review HTTP status codes"]

# Optional: plagiarism config
plagiarism:
  template_repo: "inno-se-toolkit/se-toolkit-lab-3"
  threshold: 0.5
  include_extensions: [".py"]

tasks:
  - id: setup
    title: "Lab setup"
  - id: task-1
    title: "Task 1: ..."
    prerequisite: setup
  - id: task-2
    title: "Task 2: ..."
    prerequisite: task-1

checks:
  - id: setup_repo_exists
    task: setup
    title: "Repo exists and is accessible"
    class: structural
    runner: code
    type: repo_exists
    is_required: true
    weight: 5
    hint: >
      Your repository is not accessible. Make sure you forked the lab repo.
    params: {}
  # ... more checks ...
```

## CheckSpec fields

Defined in `autochecker/spec.py:CheckSpec`.

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `id` | string | required | Unique ID within the spec, convention `t{N}_{name}` |
| `type` | string | required | One of the check types (see [[03 Check Engine]]) |
| `runner` | `"code"` \| `"llm"` | `"code"` | Dispatcher — code engine or LLM analyzer |
| `class` | `structural` \| `process` \| `content` | — | Human-facing category (alias `check_class`) |
| `task` | string | — | Task group ID; used by `--task` filter and the bot menu |
| `hint` | string | — | Student-facing failure message |
| `description` / `title` | string | `""` | Human-readable check label |
| `params` | dict | `{}` | Type-specific parameters |
| `is_required` / `required` | bool | `true` | Counts toward the required score |
| `weight` | float | `1.0` | Used by weighted scoring |
| `depends_on` | `list[str]` | `[]` | IDs of checks that must pass first |
| `tutoring` | `TutoringSpec` | — | Templates for structured feedback (see below) |
| `escalation` | `EscalationSpec` | — | Policy for deeper diagnostic agent (see below) |

## TutoringSpec (future-facing)

```yaml
tutoring:
  short_reason_template: "The API is not reachable."
  detailed_reason_template: "GET /health timed out during the check."
  likely_cause_template:  "The service may not be running or is on the wrong port."
  next_steps:
    - "Run the service with `uv run poe serve`"
    - "Check logs for startup errors"
```

The engine does not produce this output today. Wiring it up is Milestone 1 of the backend+AI roadmap. The contract is already validated by `verify.py`.

## EscalationSpec (future-facing)

```yaml
escalation:
  enabled: true
  after_failed_attempts: 3
  strategy: "vm_runtime_diagnosis"
  params:
    log_path: "/var/log/app.log"
```

After `after_failed_attempts` failed attempts for a check, the system launches a deeper diagnostic (reading logs, inspecting VM state) instead of re-running the same failing check. Implementation is Milestone 2 of the backend+AI roadmap.

## Runtime substitution

Any check with `params.runtime: prod` (and a matching entry under top-level `runtime:`) gets `{server_ip}` and `{vm_username}` substituted at check time. The bot stores these per student. Example:

```yaml
runtime:
  prod:
    base_url: "http://{server_ip}:42002"

checks:
  - id: t1_api_healthy
    type: http_check
    params:
      runtime: prod
      path: "/health"
      expect_status: 200
```

When the bot runs this check for a student whose VM IP is `10.93.1.42`, the URL becomes `http://10.93.1.42:42002/health`.

## Spec for common check types

### `http_check`

```yaml
type: http_check
params:
  runtime: prod                     # auto-substitute server_ip
  path: "/api/items"                # appended to base_url
  method: GET                        # default GET
  headers:                           # optional
    Authorization: "Bearer {lms_api_key}"
  body: '{"name":"x"}'               # optional for POST/PUT
  expect_status: 200                 # expected HTTP status
  expect_regex: "^\\[.*\\]$"         # optional regex against body
  timeout: 10
```

### `ssh_check`

```yaml
type: ssh_check
params:
  runtime: prod
  username: autochecker              # default: autochecker
  port: 22
  command: "systemctl is-active fail2ban"
  expect_exit: 0                     # expected exit code (-1 = any non-zero)
  expect_regex: "^active$"
  timeout: 10
```

Public IPs go direct; internal IPs (10.x.x.x, 172.16-31.x, 192.168.x) go through the relay worker.

### `clone_and_run`

```yaml
type: clone_and_run
params:
  timeout: 180
  env:
    API_TOKEN: "test"
  commands:
    - "uv sync"
    - "uv run poe test"
  expect_exit: 0
```

Runs inside an ephemeral Docker container (image `autochecker-sandbox:latest`) built from `deploy/Dockerfile.sandbox`. Falls back to local subprocess if Docker is unavailable (only in local dev).

### `llm_judge`

```yaml
runner: llm
type: llm_judge
params:
  path: "docs/architecture.md"
  rubric: |
    Evaluate how well the document answers:
    - Who is the target user?
    - What problem does the product solve?
    - What are the main architectural components?
  min_score: 3                       # pass threshold on a 0-5 scale
```

### `agent_eval`

Used in lab-06 to grade a student-built LLM agent. The engine SSH's into the student VM, runs their agent against a hidden question set, captures the output JSON, and grades it with both keyword rules and an LLM judge. Thresholds are declared in `lab-06-eval.yaml`.

See `docs/lab-06-eval-reference.md` for the full eval flow.

## Required fields per top-level section

| Section | Required | Notes |
|---------|----------|-------|
| `id` | yes | Lab ID, must match the filename stem |
| `title` | no | Defaults to empty string |
| `repo_name` | no (but effectively yes) | Overridden by `LAB_CONFIG[lab].repo_suffix` at runtime |
| `tasks` | no | Empty list is allowed; bot menu will be empty |
| `checks` | yes | At least one check |
| `discovery` / `runtime` / `scoring` | no | Free-form dicts — the engine reads specific keys |

Unknown top-level keys are silently ignored (`class Config: extra = "ignore"` on `LabSpec`).

## Adding a new lab

See `README.md` § "Adding a New Lab Spec" for the full step-by-step. Short version:

1. Write `specs/lab-XX.yaml`
2. Add an entry to `LAB_CONFIG` in `autochecker/cli.py`
3. Add the lab ID to `ACTIVE_LABS` in `deploy/.env`
4. Validate: `uv run python -c "from autochecker.spec import load_spec; load_spec('specs/lab-XX.yaml')"`
5. Test a known student: `uv run python main.py check -s <name> -l lab-XX -p github`
6. Rebuild and redeploy (`docker compose build && docker compose up -d`)

## Keeping specs in sync with lab instructions

When the lab README or task files change, update the spec. `CONTRIBUTING.md` has a checklist for this; the summary:

- Acceptance criteria in the task file should each have a matching check
- Markdown headings are case-sensitive — "Product Choice" ≠ "Product choice"
- Issue title regexes use `(?i)` for case-insensitive matching
- LLM rubrics should reflect the current acceptance criteria

## Related notes

- [[03 Check Engine]] — what each check type actually does
- [[11 Product Roadmap]] — where tutoring/escalation specs are headed
- [[05 Telegram Bot]] — how the bot consumes `tasks:` to build its menu
