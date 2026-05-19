---
tags: [plagiarism, batch]
---

# 10 Plagiarism Detection

Plagiarism analysis runs automatically as part of the `batch` command. It compares every student's code and git history against every other student, subtracts noise from the upstream template, and flags suspicious pairs for instructor review.

Implementation: `autochecker/plagiarism_checker.py` (824 lines). Deep investigation helper: `scripts/investigate_pair.py`.

## Data pipeline

```
batch command
  ├─ check each student (parallel workers)
  ├─ clone every student's repo + the template repo
  ├─ compute file hashes (MD5) for each repo, minus files identical to template
  ├─ pull git log for each repo, minus template commits
  ├─ cross-compare every pair:
  │     file-similarity  = shared_hashes / min(files_a, files_b)
  │     git-history      = shared commit SHAs, shared messages, shared author emails
  ├─ apply noise filters (see below)
  └─ write:
        plagiarism_report.json           (file-similarity pairs above threshold)
        plagiarism_detailed_report.html  (side-by-side file contents)
        git_plagiarism_flags.json        (git-history flags)
        git_plagiarism_report.html       (formatted table)
        batch_summary.html               (per-student scores + links to reports)
```

## Signals it uses

### File similarity

- MD5 hash of every source file in each student's repo
- Subtract files whose hash matches the template repo (every fork starts identical)
- Pair similarity: `shared_file_hashes / min(file_count_a, file_count_b)`
- Threshold configurable (`--threshold`, default `0.5`)

### Git history

Cross-compared across all student repos:

| Signal | Severity | What it means |
|--------|----------|---------------|
| **Shared commit SHAs** | critical | Identical commit objects — one repo has another student's literal commits |
| **Identical commit messages** | high | Same non-trivial message across students |
| **Shared author emails** | medium | One student's git email appears in another's commits |

Shared SHAs only happen when a student clones or pushes another student's history. They are the strongest signal. Shared messages are weaker because labs often suggest specific conventional commit messages.

## Noise filters

False positives are common without filtering. The checker applies these automatically:

| Filter | What it removes |
|--------|-----------------|
| Template file subtraction | Files with the same hash as the upstream template (unchanged by students) |
| Template commit exclusion | All commit SHAs and messages inherited from the template |
| Merge commit filtering | Author emails from `"Merge pull request"` commits (PR reviewers, not plagiarism) |
| Popularity threshold | File hashes, commit messages, or emails shared by more than 10% of the cohort (prescribed fixes, lab-instructed messages) |
| Trivial message skip | `"initial commit"`, `"update readme.md"`, and messages under 10 characters |

## CLI

```bash
uv run python main.py batch \
  -s students.txt \
  -l lab-03 \
  --template-repo inno-se-toolkit/se-toolkit-lab-3 \
  --plagiarism \
  --threshold 0.5 \
  -w 5 \
  -o /tmp/lab3-results
```

Flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `--plagiarism / --no-plagiarism` | on | Toggle plagiarism analysis |
| `--template-repo owner/name` | from spec | Upstream template repo for diff-based comparison |
| `--threshold 0.5` | `0.5` | Minimum similarity ratio to flag |

## Spec config

Plagiarism defaults can live in the lab YAML so the operator doesn't need to pass them every time:

```yaml
plagiarism:
  template_repo: "inno-se-toolkit/se-toolkit-lab-3"
  threshold: 0.5
  include_paths:
    - "src/*"
  exclude_paths:
    - "docs/*"
  include_extensions:
    - ".py"
    - ".js"
```

## Output interpretation

| Evidence | Verdict |
|----------|---------|
| Shared commit SHAs + identical modified files + cross-author emails | **Confirmed** — one repo forked/merged from another |
| `"Merge pull request from <other-student>"` in git log | **Confirmed** — direct merge |
| Many identical modified files, no shared SHAs, code diffs are trivial | **Probable** — manual copy; needs timeline review |
| Only shared commit messages + identical prescribed fixes | **Not plagiarism** — lab instructions produced identical output |
| Shared author email from merge commits only | **PR reviewer** — expected workflow |

## Deep investigation

For a flagged pair, run `scripts/investigate_pair.py`:

```bash
uv run python scripts/investigate_pair.py \
  --student-a AleksKornilov07 --student-b venimu \
  --repo se-toolkit-lab-4 \
  --template inno-se-toolkit/se-toolkit-lab-4
```

Produces a structured JSON report in `reports/investigations/`:

- **File comparison against template** — every file as template-unchanged, identical-modified (suspicious), or different
- **Git timeline** — who committed what, when (establishes who did it first)
- **Cross-author analysis** — does student A's email appear as author of commits in B's repo?
- **Shared commit SHAs** — same as batch but with full context
- **Source file diffs** — actual code differences
- **Non-ASCII scan** — flags unusual Unicode (homoglyphs from keyboard-layout switching)

## Known limitations

The automated screening catches students who **fork, clone, or merge** each other's repos. It does **not** catch manual copy-paste where the student retypes code and commits under their own identity — those cases produce different commit SHAs and may produce slightly different file hashes after minor edits.

For those cases, the investigation script helps with:

- Timeline analysis (who did it first)
- File diffing (how similar are the non-identical files)
- Non-ASCII scanning (homoglyphs, mixed-script copying)

But manual flags from TA reports, suspicious score patterns, or direct observation remain necessary as inputs.

## Reports directory

Analysis reports land in `reports/` with date-stamped subdirectories, e.g. `reports/lab3-plagiarism-2026-02-27/`. These are not auto-generated by the bot; save them manually after review as permanent audit artifacts.

## Related notes

- [[03 Check Engine]] — `batch_processor` kicks off plagiarism after per-student checks
- [[04 Lab Specs]] — the `plagiarism:` block in YAML
