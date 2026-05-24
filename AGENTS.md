# Autochecker — Project Brief for AI Agents

## What This Is

A multi-tenant AI homework grading platform for universities. Students submit GitHub repos, the system grades them with Claude Haiku, and results appear in a web dashboard + Telegram bot.

**Production URL:** `https://dellover.live`
**Stack:** FastAPI + PostgreSQL + Next.js 14 + aiogram 3 + Claude Haiku

---

## Critical Rules

1. **Always use `uv run`** for Python — deps live in uv's venv. Never `python3` directly.
2. **Never edit files in `specs/`** — these are live lab YAML specs, mentor-optimized.
3. **Never delete `bot/`** — hybrid web + Telegram architecture is intentional.
4. **Always respond in Russian** — the primary user communicates in Russian.
5. **Data isolation** — every query on non-superadmin routes must filter by `university_id`.

---

## Roles & Access

| Role | DB value | university_id | Can access |
|------|----------|---------------|------------|
| Super Admin | *(env key, no DB row)* | — | All universities |
| University Admin | `admin` | own | Own university only |
| Teacher | `teacher` | own | Own university only |
| Student | `student` | own | Own university only |

Super admin authenticates via `SUPERADMIN_KEY` header — not JWT.
All other roles use JWT Bearer tokens.

---

## Key Files

### Backend (`api/`)
| File | Purpose |
|------|---------|
| `app.py` | FastAPI app, middleware, router registration |
| `auth.py` | JWT encode/decode, `hash_password`, `verify_password` |
| `database.py` | async psycopg3 pool, `fetchone`, `fetchall`, `execute`, `execute_returning` |
| `dependencies.py` | `require_student`, `require_teacher`, `require_admin`, `require_any` |
| `models.py` | Pydantic models: `AssignmentCreate`, `AssignmentResponse`, `SubmissionResponse` |
| `worker.py` | Background grading: `process_submission()`, `_fetch_repo_files()`, `_compute_repo_hash()` |
| `routes/auth.py` | `POST /auth/login` → returns JWT + role |
| `routes/student.py` | assignments (class-filtered), submit, submissions, leaderboard, ask-LLM |
| `routes/teacher.py` | students list, student detail, submissions, AI summaries |
| `routes/admin.py` | university-scoped CRUD: users, assignments (with class_id), classes, submissions |
| `routes/superadmin.py` | platform CRUD: universities, users, classes, assignments (all universities) |
| `routes/user.py` | `PATCH /user/me` — edit own profile, email, password (requires old password) |
| `routes/chat.py` | student ↔ teacher messaging |
| `llm/adapter.py` | `llm_complete(system, user)` — provider-agnostic (anthropic/openai/google) |
| `llm/repo_checker.py` | `check_repo(spec, snapshot, reference_solution)` — grades code |
| `llm/spec_generator.py` | `generate_spec(description)` — creates assignment rubric |

### Frontend (`frontend/src/app/`)
| Path | Purpose |
|------|---------|
| `page.tsx` | Landing page |
| `login/` | Student + teacher login (`auth_token` in localStorage) |
| `dashboard/` | Student + teacher dashboard (role-aware sidebar) |
| `dashboard/profile/` | Edit name, email, password (old pw required), avatar |
| `dashboard/top10/` | Leaderboard: `/student/leaderboard` for students, `/teacher/students` for teachers |
| `admin/login/` | Admin login → stores JWT in `admin_auth_token` (separate from `auth_token`) |
| `admin/page.tsx` | University admin panel: Users / Assignments / Submissions / Classes tabs |
| `admin/classes.tsx` | Class management (create, edit name/teacher, manage members) |
| `superadmin/login/` | Key-based super admin login |
| `superadmin/page.tsx` | University list + per-university management (Users/Classes/Assignments tabs) |

### Database migrations (run in order)
```
db/schema_v2.sql                        ← full schema, run once
db/migrate_add_repo_hash.sql
db/migrate_add_reference_solution.sql
db/migrate_add_classes.sql
db/migrate_add_class_to_assignments.sql
```

---

## Important Patterns

### Grading cache
Submissions are cached by `repo_hash` (SHA-256 of sorted file contents). Same code → instant cached result. Changed code → new grading.

### JSON prefill (Anthropic)
```python
messages=[
    {"role": "user", "content": user_msg},
    {"role": "assistant", "content": "{"},  # forces valid JSON
]
# Prepend "{" to response before parsing
```

### Admin token isolation
```
auth_token        → student/teacher dashboard
admin_auth_token  → admin panel (/admin/*)
superadmin_key    → super admin panel (/superadmin/*) [localStorage key, not JWT]
```

### Class-based assignment visibility
Students only see assignments where:
- `class_id IS NULL` (visible to all), OR
- `class_id IN (their class memberships)`

### Tenant isolation pattern
Every admin/teacher/student route must filter by `user["university_id"]` from the JWT. Never trust client-sent `university_id`.

---

## API Endpoints Summary

### Public
- `POST /auth/login` → `{access_token, role, user_id, full_name}`

### Student (`require_student`)
- `GET /student/assignments` — class-filtered
- `POST /student/submit` — queue grading job
- `GET /student/submissions` — own history
- `GET /student/submissions/{id}` — result + feedback
- `POST /student/submissions/{id}/ask` — ask AI about result
- `GET /student/leaderboard` — top-10 in university

### Teacher (`require_teacher` = admin or teacher)
- `GET /teacher/students` — all students with stats
- `GET /teacher/students/{id}` — student detail + submissions
- `GET /teacher/submissions` — all submissions
- `GET /teacher/assignments` — all assignments

### Admin (`require_admin` or `require_teacher`)
- `GET/POST /admin/users` — list/create users (teacher/student only)
- `PATCH /admin/users/{id}` — edit email/password
- `DELETE /admin/users/{id}`
- `GET/POST /admin/assignments` — CRUD (with class_id, reference_solution)
- `POST /admin/assignments/upload` — create from file (txt/md/pdf/docx)
- `GET/POST/DELETE /admin/classes` — class management
- `POST/DELETE /admin/classes/{id}/members` — add/remove students
- `GET /admin/submissions` — all university submissions

### Super Admin (X-Superadmin-Key header)
- `POST /superadmin/auth` — verify key
- `GET/POST/DELETE /superadmin/universities` — university CRUD
- `GET/POST/PATCH/DELETE /superadmin/universities/{id}/users`
- `GET/POST/DELETE /superadmin/universities/{id}/classes`
- `GET/POST/DELETE /superadmin/universities/{id}/assignments`

### User (any authenticated)
- `PATCH /user/me` — edit name, email, password (old pw required for pw change)

---

## Definition of Done

- TypeScript compiles (`npx tsc --noEmit`) with zero errors
- All API routes filter by `university_id` (no cross-tenant leaks)
- New DB columns have `IF NOT EXISTS` migrations in `db/`
- Migration added to `.github/workflows/deploy.yml` before restart step
- No `console.log` or debug prints left in production code
- Committed and pushed — CI/CD handles deploy automatically

---

## Server Info

- **Host:** `159.89.0.231`, port `2222`, user `nurassyl`
- **PostgreSQL container:** `autochecker-db`
- **Services:** `autochecker-api`, `autochecker-bot`, `autochecker-frontend` (systemd)
- **Frontend dir:** `/home/nurassyl/autochecker-frontend/`
- **Backend dir:** `/home/nurassyl/autochecker/`
- **Run migration:** `cat db/file.sql | docker exec -i autochecker-db psql -U autochecker -d autochecker`
