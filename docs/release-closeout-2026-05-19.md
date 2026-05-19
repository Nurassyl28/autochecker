# Release Closeout (2026-05-19)

## Shipped Today

1. Stable student tutor feedback contract in runtime output.
- Added normalized tutor aliases in structured feedback:
  - `what_failed`
  - `why_failed`
  - `what_to_do_next`
- Normalized status and list fields for backward-compatible payload stability.

2. Deep escalation diagnostics upgraded.
- Added structured diagnostic payload fields:
  - `failure_taxonomy`
  - `failure_status`
  - `diagnostic_status`
  - `sources`
  - `report_context`
  - `vm_snapshot`
- Added source adapters:
  - `collect_repo_evidence`
  - `collect_log_evidence`
  - `collect_vm_evidence`

3. Teacher-assistant aggregation improved.
- Taxonomy-aware failure clustering in teacher summary endpoints.
- Added `failure_taxonomy_breakdown` to:
  - student summary
  - task summary
  - cohort summary
- Added taxonomy-based intervention suggestion mapping.

4. Compatibility hardened.
- Legacy payloads (missing taxonomy/diagnostic, invalid JSON) are handled safely.

5. Verification status.
- `uv run pytest -q` passed.
- `uv run python verify.py` passed.

## Deferred (Not Shipped Today)

1. Per-check specialized VM diagnostic command sets by check type.
2. Dedicated persistence layer/table for diagnostics analytics (instead of only `results.details` JSON payload).
3. Frontend integration work (UI wiring and presentation polish).

## Final Status

Backend+AI scope planned for today is completed and verified.
