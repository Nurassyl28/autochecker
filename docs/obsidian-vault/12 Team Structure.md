---
tags: [team, ownership]
---

# 12 Team Structure

One team, split into two delivery pairs. Ownership is by *surface*, not by feature — a feature can touch both sides and usually does.

## The two pairs

| Pair | Disciplines | Primary surfaces |
|------|-------------|------------------|
| **Backend + AI** | Backend developer · AI developer | `autochecker/`, `bot/`, data paths in `dashboard/app.py`, `relay/` |
| **Frontend + UI/UX** | Frontend developer · UI/UX designer | `dashboard/templates/`, dashboard presentation, bot wording, flow design |

## File ownership

| File / area | Primary owner |
|-------------|---------------|
| `autochecker/spec.py` | Backend + AI |
| `autochecker/engine.py` | Backend + AI |
| `autochecker/llm_analyzer.py` | Backend + AI |
| `autochecker/reporter.py` | Backend + AI |
| `bot/` (all handlers + DB) | Backend + AI |
| `relay/worker.py` | Backend + AI |
| Data paths in `dashboard/app.py` | Backend + AI |
| `dashboard/templates/` | Frontend + UI/UX |
| Presentation paths in `dashboard/app.py` | Frontend + UI/UX |
| Student-facing copy / wording | Frontend + UI/UX |
| Information hierarchy, layouts | Frontend + UI/UX |
| `specs/*.yaml` (content) | Shared — usually Backend + AI writes, both review |
| Deployment / Docker / env | Backend + AI |

## Collaboration rule

> Backend + AI owns data shape and business logic.
> Frontend + UI/UX owns display structure and interaction presentation.

When data structure needs to change to support a new UX, Backend + AI picks the shape; when presentation changes require new fields, Frontend + UI/UX requests them through the inter-team contract rather than reading from implementation details.

## Inter-team contract

### What Backend + AI provides

- Stable structured result shapes
- Stable summary payloads (student, task, cohort)
- Clear status types for checks and escalations
- Explicit fields for student feedback and teacher summaries
- Predictable response shapes for dashboard + bot

### What Frontend + UI/UX provides

- Screen-level flows
- Display requirements for new feedback states
- UX requirements for tutor mode, escalation mode, teacher summary mode
- Wording rules for technical vs beginner-friendly tracks
- Explicit "I need these fields" requests to Backend + AI

## Who the current user is

Backend developer. Paired with AI. Works closely with `autochecker/`, `bot/`, data-layer of `dashboard/`, and `relay/`.

## Task decomposition rule

When planning work, prefer to keep Backend + AI changes in one PR/task bundle and Frontend + UI/UX changes in another. Cross-cutting features are split at the contract boundary (new data field → Backend; new presentation of the field → Frontend).

## Skipping to concrete workstreams

| Workstream | Owner |
|-----------|-------|
| A — Product logic (spec, tutoring, summaries) | Backend + AI |
| B — Diagnostic intelligence (escalation agent) | Backend + AI |
| C — Student experience | Frontend + UI/UX |
| D — Teacher experience | Frontend + UI/UX |
| E — Content and tracks | Shared |

See [[11 Product Roadmap]] for the full breakdown.

## Related notes

- [[11 Product Roadmap]] — workstreams and deliverables
- [[01 Overview]] — what the product is
