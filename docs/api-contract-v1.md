# API Contract v1

This document defines the current stable backend contract for frontend integration.

## Auth

- `Authorization: Basic <base64(email:password)>`
- Password format: `{github_alias}{tg_username}`
- Unauthorized response:
  - `401 {"error":"unauthorized"}`

## Tenant and Role Scope

- Auth context resolves:
  - `tenant_id`
  - `role`
- Teacher summary APIs require role:
  - `teacher`
  - `university_admin`
  - `superadmin`
- Non-teacher roles receive:
  - `403 {"error":"forbidden"}`

## Endpoints

## `GET /api/items`

Returns available labs/tasks derived from active specs.

Response:
```json
[
  {"lab":"lab-01","task":null,"title":"Lab 01 ...","type":"lab"},
  {"lab":"lab-01","task":"task-1","title":"Task 1 ...","type":"task"}
]
```

## `GET /api/logs?since=<iso>&limit=<n>`

Returns anonymized submission logs for ETL.

Response:
```json
{
  "logs": [
    {
      "id": 123,
      "student_id": "a1b2c3d4",
      "group": "G1",
      "lab": "lab-01",
      "task": "task-1",
      "score": 75.0,
      "passed": 3,
      "failed": 1,
      "total": 4,
      "checks": [{"check_id":"x","title":"...","passed":true}],
      "submitted_at": "2026-05-19T08:30:00Z"
    }
  ],
  "count": 1,
  "has_more": false
}
```

## `GET /api/teacher/summary/student/{github_alias}`

Teacher-assistant summary for one student.

Response:
```json
{
  "student": "alias",
  "tenant_id": "default",
  "completion_rate": 66.7,
  "tasks": [
    {"lab_id":"lab-01","task_id":"task-1","score":"75%","status":"pass","timestamp":"..."}
  ],
  "common_failures": [{"pattern":"...","count":2}],
  "intervention_suggestions": ["..."]
}
```

## `GET /api/teacher/summary/task?lab_id=...&task_id=...`

Response:
```json
{
  "lab_id": "lab-01",
  "task_id": "task-1",
  "tenant_id": "default",
  "students_total": 20,
  "students_passed": 12,
  "pass_rate": 60.0,
  "common_failures": [{"pattern":"...","count":5}],
  "escalation_states": {"none": 10, "eligible": 6, "completed": 4}
}
```

## `GET /api/teacher/summary/cohort?lab_id=...`

Response:
```json
{
  "tenant_id": "default",
  "lab_id": "lab-01",
  "groups": [{"group":"G1","results_count":30,"pass_rate":70.0}],
  "common_failures": [{"pattern":"...","count":12}],
  "interventions": [{"pattern":"...","count":12,"suggestion":"..."}]
}
```

## `GET /api/access-log/{github_alias}`

- Requires `Authorization: Bearer <RELAY_TOKEN>`
- Returns per-endpoint call summary for this user.

## `GET /api/eval/question?lab=...&index=...`

Returns one non-hidden eval question for local testing flows.
