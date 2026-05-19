---
tags: [roadmap, product]
---

# 11 Product Roadmap

Autochecker is being upgraded — not rewritten — from a lab checker into two product experiences: an **AI tutor** for students and an **AI teacher-assistant** for instructors. The existing architecture (spec-driven, Telegram bot, dashboard, relay) stays; new layers extend it.

Source of truth: `AGENTS.md`, `spec/project-spec.md`, `spec/backend-ai-spec.md`, `spec/frontend-uiux-spec.md`.

## Vision in three sentences

- **Students** should feel guided by a tutor: feedback that explains what failed, why, and what to do next — not just pass/fail.
- **Instructors** should feel supported by an AI teaching assistant: cohort summaries, common-mistake clustering, intervention suggestions.
- **Platform** should stay spec-driven, operationally reliable, and extensible for new tracks (including non-technical learners).

## Product requirements

### 1. Student tutor mode

- Structured failure explanation (not just `hint`)
- Root-cause-oriented feedback
- Clear next-step recommendations
- Better phrasing and product framing in bot + dashboard output

### 2. Escalation agent flow

After a configurable number of failed attempts on the same check:

- Trigger a deeper diagnostic run
- Inspect repo content, logs, and VM state where available
- Produce targeted fix guidance
- Store enough structured output for useful history

### 3. Teacher-assistant mode

- Per-student summary
- Per-task summary
- Cohort-level summary
- Common-failure clustering
- Intervention suggestions

### 4. Assignment authoring improvements

Make it easier to define labs, rubrics, hints, escalation triggers, tutoring content, teacher summary content, and agent checks — without hand-editing every YAML field.

### 5. Non-technical learning track

- Smaller task chunks
- Softer wording
- Glossary and guided explanations
- Less intimidating presentation for beginner learners

## Phases

### Phase 1 — Student feedback structure

- Extend spec model with tutoring metadata (`TutoringSpec`) — **done in `autochecker/spec.py`**
- Wire engine to produce `StructuredFeedback` — **done**
- Render structured feedback in bot + HTML report — **done**

### Phase 2 — Escalation

- Implement `EscalationSpec` execution path — **done (attempt-threshold based)**
- Build diagnostic-agent layer that inspects repo + VM — **partial (diagnostic payload active, full external agent pending)**
- Persist escalation state; expose it to bot + dashboard — **done**

### Phase 3 — Teacher assistant

- Summary generation per student, per task, per cohort — **done via API**
- Failure clustering — **basic implementation in API**
- Dashboard cohort analytics view — **pending UI integration**
- Intervention recommendations — **basic API suggestions implemented**

### Phase 4 — Beginner track

- Alternate tutoring prompts for non-technical tracks
- Glossary / explanation patterns
- Simpler spec patterns for smaller tasks

## Workstreams

| Workstream | Name | Owner |
|-----------|------|-------|
| A | Product logic: spec extensions, tutoring metadata, summary generation | Backend + AI |
| B | Diagnostic intelligence: agent layer, repo + VM inspection, root-cause output | Backend + AI |
| C | Student experience: bot responses, result formatting, next-step clarity | Frontend + UI/UX |
| D | Teacher experience: dashboard summaries, cohort analytics, clustering views | Frontend + UI/UX |
| E | Content and tracks: beginner / non-technical variants, guided learning prompts | Shared |

## What's already in place

- ✅ Structured feedback Pydantic contract (`StructuredFeedback` in `autochecker/spec.py`)
- ✅ Tutoring spec fields (`TutoringSpec`, `EscalationSpec`, `TeacherSummarySpec`)
- ✅ `learning_objectives` and `teacher_summary` fields on `LabSpec`
- ✅ Extended-spec validation in `verify.py`
- ✅ Existing hint system (can be the fallback while structured feedback ramps up)

## What's not yet built

- ❌ Full standalone diagnostic-agent execution pipeline (repo+VM deep run as separate orchestrated stage)
- ❌ Full dashboard UI for teacher summaries/cohort analytics
- ❌ Beginner-track prompts and guided glossary flow
- ❌ Full PostgreSQL runtime cutover (schema is prepared; app still runs on SQLite by default)

## Backend + AI deliverables

From `spec/backend-ai-spec.md`:

- **A — Spec model extension** — tutoring text, escalation triggers, learning objectives, teacher summary (partially complete)
- **B — Structured feedback model** — uniform shape consumed by bot and dashboard (contract exists; producers don't)
- **C — Escalation agent layer** — deeper diagnostic path that inspects repo + VM, produces structured root-cause output
- **D — Bot flow upgrade** — track repeated failures, decide escalation, show action-oriented feedback
- **E — Teacher data APIs** — stable structured fields for per-student / per-task / cohort summaries + clusters

## Frontend + UI/UX deliverables

From `spec/frontend-uiux-spec.md`:

- **A — Product framing** — student-facing vs teacher-facing terminology, escalation-state wording
- **B — Student feedback UX** — failure explanation, likely cause, next steps, retries, escalation states
- **C — Teacher summary UX** — per-student progress, per-task difficulty, cohort patterns, interventions
- **D — Beginner-track UX** — softer wording, guided steps, glossary

## Inter-team contract

Backend + AI exposes stable, structured fields. Frontend + UI/UX owns how those fields display.

Backend produces:
- check status (`PASS` / `FAIL` / `ERROR`)
- `short_reason`, `detailed_reason`, `likely_cause`
- `next_steps` (list)
- `escalation_state` (`none` / `eligible` / `triggered` / `completed`)
- student summary payloads
- teacher summary payloads
- cohort analytics payloads

Frontend produces:
- agreed display contract
- required fields per view
- UX states for escalation flow
- wording rules per track

## Definition of done (project-wide)

- Existing flows (check, bot, dashboard, reporting) still work
- Student-facing output is more useful than raw pass/fail
- The system can escalate repeated failures into deeper diagnostics
- Teachers can view summarized, actionable information
- Ownership boundaries between the two subteams remain clear
- Relevant verification still passes

## What explicitly not to do

From `AGENTS.md` and the project spec:

- Don't rewrite the engine
- Don't break spec-driven behavior
- Don't rename files without a clear reason
- Don't split UX-only decisions into backend logic (or vice versa)
- Don't overcouple agent behavior to a single lab
- Don't introduce parallel subsystems when extending the existing ones works

## Related notes

- [[01 Overview]] — current platform capabilities
- [[03 Check Engine]] — where structured feedback will plug in
- [[04 Lab Specs]] — tutoring and escalation YAML
- [[12 Team Structure]] — who owns what
