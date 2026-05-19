# Backend API Handoff (2026-05-19)

## Auth + Scope
- Basic auth: `email` + password format `${github_alias}${tg_username}`.
- Tenant scope:
  - regular roles: fixed to their own tenant
  - `superadmin`: can override tenant where supported

## Roles
- `student`
- `teacher`
- `university_admin`
- `superadmin`

## Assignments

### Create / Upsert assignment (admin)
- `POST /api/admin/assignments`
- form fields:
  - `code`
  - `title`
  - `prompt_text`
  - optional `tenant_id` (superadmin only)
- result: assignment saved with generated compact `llm_spec`.

### Update assignment (admin)
- `POST /api/admin/assignments/{code}`
- form fields:
  - `title`
  - `prompt_text`
  - optional `tenant_id`

### Deactivate assignment (admin)
- `POST /api/admin/assignments/{code}/deactivate`

### Delete assignment (admin)
- `POST /api/admin/assignments/{code}/delete`

### List assignments (student/teacher/admin)
- `GET /api/assignments`
- query:
  - optional `tenant_id` (superadmin only)

## Chat (teacher <-> student, shared across all tasks)

### Create/Get thread (teacher starts)
- `POST /api/chat/thread`
- form:
  - `student_github_alias`
  - optional `tenant_id`

### List my threads
- `GET /api/chat/threads`

### Send message
- `POST /api/chat/messages`
- form:
  - `thread_id`
  - `body`
  - optional `tenant_id`

### Get thread messages
- `GET /api/chat/messages?thread_id=...&limit=...`

## Teacher Summaries
- `GET /api/teacher/summary/student/{github_alias}`
- `GET /api/teacher/summary/task?lab_id=...&task_id=...`
- `GET /api/teacher/summary/cohort?lab_id=...`

Includes:
- `common_failures`
- `failure_taxonomy_breakdown`
- intervention suggestions

## Diagnostic Observability
- `GET /api/teacher/diagnostics/observability?hours=...&lab_id=...`
- returns rates, breakdowns, and alert flags.

## Submission Queue (teacher visibility)
- `GET /api/teacher/submissions`
- filters:
  - `assignment_code`
  - `student_tg_id`
  - `status` (`queued|running|done|failed`)
  - `limit`

## Telegram Assignment Flow
- student runs `/assignments`
- selects assignment
- sends repo URL
- backend creates queued submission (`assignment_submissions`)
- background worker processes queue and sends result back to student in Telegram

## Status Lifecycle
- `queued`
- `running`
- `done`
- `failed`

Worker writes:
- `updated_at`
- `processed_at`
- `result_text`
- `error_message`
