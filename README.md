# Autochecker

AI-powered homework grading platform for universities. Students submit GitHub repositories, an LLM automatically checks the code against assignment criteria, and results appear in the web dashboard and Telegram bot.

**Live:** `https://dellover.live`

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 14)               │
│  /login  /dashboard  /admin  /superadmin                 │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (JWT)
┌──────────────────────▼──────────────────────────────────┐
│                   Backend (FastAPI)                       │
│  /auth  /student  /teacher  /admin  /superadmin          │
│                                                          │
│  Worker: clone repo → LLM check → save result           │
└───────┬──────────────────────────────┬──────────────────┘
        │                              │
   PostgreSQL                    Claude Haiku
   (multi-tenant)                (Anthropic API)
        │
   Telegram Bot (aiogram 3)
```

### Multi-tenant isolation

Every university is a separate tenant. All tables (`users`, `assignments`, `submissions`, `classes`) are scoped by `university_id`. Users from University A cannot see data from University B.

---

## User Roles

| Role | Access | Login URL |
|------|--------|-----------|
| **Super Admin** | All universities — create/delete universities, manage all users | `/superadmin/login` |
| **University Admin** | Own university — manage teachers, students, classes, assignments | `/admin/login` |
| **Teacher** | Own university — view students, submissions, ratings | `/login` |
| **Student** | Own university — submit repos, view results, chat with AI tutor | `/login` |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, App Router, TypeScript |
| Backend | FastAPI (Python 3.12), psycopg3 async |
| Database | PostgreSQL 15 (Docker) |
| LLM | Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic SDK |
| Bot | aiogram 3, Python |
| Auth | JWT (HS256), bcrypt passwords |
| Deploy | GitHub Actions → SSH + rsync → systemd |
| Package manager | `uv` (Python), `npm` (Node) |

---

## Project Structure

```
autochecker/
├── api/                        # FastAPI backend
│   ├── app.py                  # app factory, middleware, router registration
│   ├── auth.py                 # JWT encode/decode, password hashing
│   ├── database.py             # async psycopg3 pool, fetchone/fetchall helpers
│   ├── dependencies.py         # require_student / require_teacher / require_admin
│   ├── models.py               # Pydantic request/response models
│   ├── worker.py               # background grading: clone repo → LLM → save
│   ├── routes/
│   │   ├── auth.py             # POST /auth/login
│   │   ├── student.py          # GET assignments, POST submit, GET leaderboard
│   │   ├── teacher.py          # GET students, submissions, summaries
│   │   ├── admin.py            # CRUD users, assignments, classes (university scope)
│   │   ├── superadmin.py       # platform-level: universities + all data
│   │   ├── user.py             # PATCH /user/me (profile, email, password)
│   │   ├── chat.py             # student ↔ teacher messaging
│   │   └── bot.py              # internal bot webhook
│   └── llm/
│       ├── adapter.py          # LLM provider abstraction (Anthropic / OpenAI / Google)
│       ├── repo_checker.py     # grading prompt, JSON prefill, result parsing
│       └── spec_generator.py   # generate assignment rubric from description
├── bot/                        # Telegram bot (aiogram 3)
├── db/                         # SQL migrations
│   ├── schema_v2.sql           # full schema (run once on fresh DB)
│   ├── migrate_add_repo_hash.sql
│   ├── migrate_add_reference_solution.sql
│   ├── migrate_add_classes.sql
│   └── migrate_add_class_to_assignments.sql
├── frontend/                   # Next.js 14
│   └── src/app/
│       ├── page.tsx            # landing page
│       ├── login/              # student / teacher login
│       ├── dashboard/          # student + teacher dashboard
│       │   ├── page.tsx        # assignment list
│       │   ├── submissions/    # submission history + AI chat
│       │   ├── students/       # teacher: student roster
│       │   ├── top10/          # leaderboard
│       │   └── profile/        # edit name, email, password, avatar
│       ├── admin/              # university admin panel
│       │   ├── login/
│       │   ├── page.tsx        # users / assignments / classes / submissions tabs
│       │   └── classes.tsx     # class management component
│       └── superadmin/         # platform super admin panel
│           ├── login/
│           └── page.tsx        # university list + per-university management
├── specs/                      # legacy YAML lab specs (do not edit)
├── .github/workflows/
│   └── deploy.yml              # CI/CD: build → scp → rsync → systemd restart
├── .env.example                # all required environment variables
└── requirements.txt
```

---

## Local Development

### Backend

```bash
# Install dependencies
uv venv && uv pip install -r requirements.txt

# Set environment
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, LLM_API_KEY, TELEGRAM_BOT_TOKEN

# Run database migrations
psql $DATABASE_URL < db/schema_v2.sql
psql $DATABASE_URL < db/migrate_add_repo_hash.sql
psql $DATABASE_URL < db/migrate_add_reference_solution.sql
psql $DATABASE_URL < db/migrate_add_classes.sql
psql $DATABASE_URL < db/migrate_add_class_to_assignments.sql

# Start API
uv run uvicorn api.app:app --reload --port 8000

# Start Telegram bot
uv run python -m bot
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                        # http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL DSN (`postgresql://user:pass@host/db`) |
| `JWT_SECRET` | ✅ | Random string for signing JWTs |
| `JWT_EXPIRE_HOURS` | — | Token lifetime (default: 72) |
| `LLM_PROVIDER` | ✅ | `anthropic` / `openai` / `google` |
| `LLM_MODEL` | ✅ | e.g. `claude-haiku-4-5-20251001` |
| `LLM_API_KEY` | ✅ | API key for the chosen LLM provider |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `GITHUB_TOKEN` | — | Higher GitHub API rate limit for repo cloning |
| `SUPERADMIN_KEY` | ✅ | Secret key for super admin panel access |
| `CORS_ORIGINS` | — | Comma-separated allowed origins (default: `*`) |

---

## Database Schema

```sql
universities   id, name, slug, created_at
users          id, university_id, email, password_hash, role, full_name, tg_id
assignments    id, university_id, title, description_text, llm_spec, spec_status,
               class_id, reference_solution, created_by
submissions    id, assignment_id, student_id, repo_url, status, pass_fail,
               score, feedback_json, repo_hash, created_at, completed_at
classes        id, university_id, name, teacher_id, created_at
class_members  class_id, student_id
chat_messages  id, university_id, sender_id, receiver_id, body, created_at
```

All tables except `universities` are scoped by `university_id`. Submissions are cached by `repo_hash` (SHA-256 of file contents) — re-submitting the same code returns the cached result instantly.

---

## Grading Flow

```
Student submits repo URL
        ↓
Worker clones repo via GitHub API
        ↓
Smart file prioritization (root .py first, test_ files last, max 40 files / 10K chars each)
        ↓
Builds prompt: assignment spec + repo snapshot + optional reference solution
        ↓
Claude Haiku grades against rubric (JSON prefill for guaranteed valid output)
        ↓
Result saved to DB (pass/fail, score 0-1, per-check feedback)
        ↓
Student sees result on web + Telegram notification
```

---

## CI/CD

Push to `main` triggers GitHub Actions:

1. Build Next.js frontend on GitHub runner
2. Upload build artifacts to server via SCP
3. SSH into server:
   - `git pull`
   - `uv pip install` Python deps
   - Run SQL migrations via `docker exec autochecker-db psql`
   - `rsync` frontend build to `/home/nurassyl/autochecker-frontend/`
   - `systemctl restart autochecker-api autochecker-bot autochecker-frontend`
4. Health check `curl` to verify services are up

Server runs three systemd services: `autochecker-api`, `autochecker-bot`, `autochecker-frontend`.

---

## Key Design Decisions

- **Content-hash caching** — grading is cached by SHA-256 of repo file contents, not URL. Changing code invalidates cache; re-submitting unchanged code is free.
- **JSON prefill** — Anthropic API is called with `{"role": "assistant", "content": "{"}` to guarantee valid JSON output without extra parsing.
- **Separate admin token** — admin panel stores JWT in `admin_auth_token` (not `auth_token`) to prevent session conflicts between admin and student dashboards.
- **SUPERADMIN_KEY** — platform super admin uses a static secret key (env var), not a DB user, so it cannot be accidentally deleted.

---

## License

MIT
