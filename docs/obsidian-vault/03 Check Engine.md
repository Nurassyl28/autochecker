---
tags: [engine, autochecker]
---

# 03 Check Engine

The check engine lives in `autochecker/engine.py` and is wrapped by the single public API `check_student()` defined in `autochecker/__init__.py`. Everything else in the repo — the bot, the CLI, the batch processor — calls into this one function.

## The `check_student()` contract

```python
# autochecker/__init__.py
def check_student(
    student_alias: str,
    lab_id: str,
    task_filter: Optional[str] = None,
    platform: str = "github",
    gitlab_url: str = "https://gitlab.astanait.edu.kz",
    branch: Optional[str] = None,
    output_dir: Optional[str] = None,
    token: Optional[str] = None,
    openrouter_api_key: Optional[str] = None,
    use_cache: bool = False,
    server_ip: Optional[str] = None,        # student VM IP for runtime checks
    lms_api_key: Optional[str] = None,      # for agent_eval
    vm_username: Optional[str] = None,      # for SSH-based agent_eval
) -> StudentCheckResult: ...
```

Returns a `StudentCheckResult` dataclass with score, per-check results, and paths to the three generated artifacts: `results.jsonl`, `summary.html`, `student_report.txt`.

Raises `RuntimeError` on unrecoverable failure (unknown lab, repo not found, repo private, spec missing). Those errors are caught by the bot and shown as a friendly failure message.

## Execution flow inside `check_student`

```
1.  Resolve lab_id → LAB_CONFIG[lab_id]  (lab name, repo_suffix, ready flag)
2.  Load spec file   specs/<lab_id>.yaml   → LabSpec (Pydantic)
3.  Prepare output dir results/<student>/  (cleared of old summary + results)
4.  Create API client (GitHub or GitLab) with optional disk cache
5.  Call client.get_repo_info() — bail out if missing or private
6.  Construct RepoReader — downloads the repo as a zip into memory
7.  Determine branch (arg > spec.discovery.default_branch > repo default)
8.  Filter checks by task (if task_filter given) and split:
         code_checks  = checks where runner != "llm"
         llm_checks   = checks where runner == "llm"
9.  Instantiate CheckEngine(client, reader, branch, lab_spec, server_ip, lms_api_key, vm_username)
10. For each code check:   result = engine.run_check(...)
11. For each llm check:    result = run_llm_check(openrouter_api_key, reader, ...)
12. If any llm_checks and key present, also run analyze_repo() for deep analysis
13. Reporter writes jsonl + html + student_report
14. Compute score = passed / total * 100
15. Return StudentCheckResult
```

## CheckEngine internals

`CheckEngine` (in `autochecker/engine.py:45`) holds:

- the platform client (`GitHubClient` or `GitLabClient`)
- the `RepoReader` for file access
- the branch to inspect
- the lab spec (for cross-check context)
- optional runtime secrets: `server_ip`, `lms_api_key`, `vm_username`
- a per-run `_data_cache` that memoizes `get_commits()`, `get_issues()`, `get_pull_requests()` calls so a spec with 30 issue checks makes one API call

The entry point is `engine.run_check(check_id, check_type, params, description, hint)` at line 2330. It's a long `elif` cascade that dispatches on `check_type` to the correct handler. Every handler returns a `CheckResult` dict with `{id, status, description, details, hint}` where `status ∈ {"PASS", "FAIL", "ERROR"}`.

## All implemented check types

Roughly thirty check types are implemented. They fall into six families:

### Repository-structure checks

| Type | Purpose |
|------|---------|
| `repo_exists` | Repo URL is reachable with the current token |
| `repo_is_fork` | Repo is a fork (lab expects students to fork the template) |
| `repo_has_issues` | Issues feature is enabled |

### File-content checks

| Type | Purpose |
|------|---------|
| `file_exists` | A specific file is present |
| `glob_exists` | At least one file matches a glob |
| `file_nonempty` | File exists and is not empty |
| `file_content_match` | File contains all listed keywords |
| `file_word_count` | File has at least N words |
| `regex_in_file` | Regex matches in a file (optional `min_matches`) |
| `markdown_has_heading` | Markdown has a specific heading |
| `markdown_sections_nonempty` | Listed headings exist and their sections have text |
| `markdown_regex_all` | All listed regex patterns are found |
| `markdown_linked_files_exist` | Links in a markdown file resolve to real files |
| `markdown_section_item_count` | A section contains at least N list items |
| `urls_in_markdown_section_min` | A section contains at least N URLs |
| `links_in_file` | File contains at least N links |

### Git-history checks

| Type | Purpose |
|------|---------|
| `commit_message_regex` | At least one commit message matches a regex |

### Issue & pull-request checks

| Type | Purpose |
|------|---------|
| `issue_exists` | An issue titled to match a pattern exists |
| `issues_count` | At least N issues match a title pattern |
| `issue_body_match` | Issue bodies match a regex (with `min_count`) |
| `issue_body_regex_all` | All listed regexes appear in a matched issue's body |
| `issue_comment_regex` | Issue comments match a regex |
| `issue_has_linked_pr` | A matched issue has a PR that `Closes #N` |
| `issue_pr_approved` | PR linked to an issue has an approved review |
| `issue_pr_review_comments` | PR linked to an issue has line comments |
| `pr_merged_count` | At least N pull requests are merged |
| `pr_merged_exists` | At least one merged PR matches a pattern |
| `pr_body_regex_count` | PR bodies match a regex |
| `pr_touches_paths` | PR modified files under listed path globs |
| `pr_review_approvals` | At least N PR reviews approved |
| `pr_review_line_comments` | At least N PR line comments posted |

### Runtime / VM checks (use relay or direct SSH/HTTP)

| Type | Purpose |
|------|---------|
| `http_check` | HTTP request returns expected status / body match |
| `ssh_check` | SSH into student VM, run command, assert exit + regex |
| `clone_and_run` | Clone repo, run commands inside Docker sandbox |

### Combinators and advanced

| Type | Purpose |
|------|---------|
| `any_of` | Passes if any sub-check passes |
| `api_access_check` | Student hit the autochecker's API with their LMS key |
| `agent_eval` | Run student's agent against a question set, grade with LLM |
| `ssh_eval_set` | Run an eval set over SSH, score with LLM rubric |
| `llm_judge` | LLM scores file content against a rubric (0–5), passes if score ≥ `min_score` |

## Runners: `code` vs `llm`

Every check has a `runner` field in the spec:

- `runner: code` (default) → handled by `CheckEngine.run_check()`
- `runner: llm` → handled by `autochecker/llm_analyzer.py:run_llm_check()`

LLM checks don't share the code-check cache; they make their own API calls and each one is rate-limited to one concurrent request with a 2-second minimum interval to stay under OpenRouter quotas.

## The LLM analyzer

`autochecker/llm_analyzer.py` owns two public functions:

- **`run_llm_check(...)`** — atomic check with a rubric (`llm_judge`). Returns `{status, score, min_score, reasons, quotes}`.
- **`analyze_repo(...)`** — deep holistic analysis. Runs once per student when the spec has at least one LLM check. Returns `{verdict, task_analysis, reasons, quotes}` included in the HTML report.

All calls go through `_call_llm_api` which:

- Uses OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) by default
- Serializes requests with a semaphore + 2 s interval lock
- Retries on 429 with exponential backoff (5, 10, 20 s)
- Surfaces 402 clearly ("insufficient funds, check https://openrouter.ai/credits")
- Strips markdown fences from JSON output and fixes common LLM JSON mistakes

Default model: `google/gemini-2.5-flash-lite` (overridable via `LLM_MODEL`).

## Reports

`autochecker/reporter.py:Reporter` writes three artifacts per student:

- **`results.jsonl`** — first line is the summary object, one line per check
- **`summary.html`** — instructor-facing HTML with table, LLM analysis section, per-check hints
- **`student_report.txt`** — plain-text student-facing report with hints rendered with `->` arrows

The bot parses `summary.html` with a small regex pass (`_parse_summary_html` in `bot/handlers/check.py`) to produce Telegram-friendly text.

## Structured feedback (planned)

`autochecker/spec.py` already defines the structured feedback contract in Pydantic:

```python
class StructuredFeedback(BaseModel):
    status: CheckStatus            # PASS | FAIL | ERROR
    short_reason: str = ""
    detailed_reason: str = ""
    likely_cause: str = ""
    next_steps: List[str] = []
    hint: str = ""
    escalation_state: EscalationState = "none"  # none | eligible | triggered | completed
```

Verified in `verify.py` but not yet produced by the engine. This is Milestone 1 of the backend+AI workstream (see [[11 Product Roadmap]]).

## Related notes

- [[04 Lab Specs]] — YAML schema, check params, tutoring/escalation fields
- [[02 Architecture]] — where the engine fits in the overall flow
- [[10 Plagiarism Detection]] — plagiarism runs after batch check, not per student
