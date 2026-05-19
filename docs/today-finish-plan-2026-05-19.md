# Today Finish Plan (2026-05-19)

Goal: ship a complete backend+AI increment for AI tutor + AI teacher-assistant without architecture rewrite.

## Scope Freeze (Must Ship Today)

1. Student tutor response contract is stable in runtime output.
2. Escalation pipeline produces structured deep diagnostics with source statuses.
3. Failure taxonomy is emitted and used in teacher summary aggregation.
4. Teacher summary APIs return actionable intervention suggestions.
5. Backward compatibility for existing specs/results is preserved.
6. Tests and verification are green via `uv`.

Out of scope today:
- Full frontend implementation.
- Broad DB schema redesign.
- New product areas outside tutor/escalation/teacher-summary flow.

## Execution Order

1. Backend+AI core stabilization
- finalize deep diagnostics payload v1
- ensure repo/log/vm evidence adapters are wired
- keep tenant/RBAC behavior unchanged

2. Teacher assistant aggregation
- taxonomy-based clustering in student/task/cohort summaries
- intervention suggestions from taxonomy

3. Spec/runtime compatibility pass
- confirm old payloads and missing fields are handled safely

4. Verification gate
- `uv run pytest -q`
- `uv run python verify.py`

5. Release close
- short change summary in chat
- remaining gaps (if any) listed explicitly

## Done Criteria (Today)

- Functional: all items in "Must Ship Today" implemented.
- Quality: tests pass and no known regression in bot/dashboard/check flow.
- Clarity: any not-finished items are explicitly marked with concrete next step.
