-- Autochecker PostgreSQL schema (multi-tenant + RBAC baseline)

CREATE TABLE IF NOT EXISTS universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    tg_id BIGINT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    role TEXT NOT NULL DEFAULT 'student',
    email TEXT NOT NULL,
    github_alias TEXT NOT NULL,
    tg_username TEXT NOT NULL DEFAULT '',
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    server_ip TEXT NOT NULL DEFAULT '',
    student_group TEXT NOT NULL DEFAULT '',
    lms_api_key TEXT NOT NULL DEFAULT '',
    vm_username TEXT NOT NULL DEFAULT '',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_github ON users(tenant_id, github_alias);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

CREATE TABLE IF NOT EXISTS attempts (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    lab_id TEXT NOT NULL,
    task_id TEXT NOT NULL DEFAULT '',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempts_lookup ON attempts(tenant_id, tg_id, lab_id, task_id);

CREATE TABLE IF NOT EXISTS attempt_grants (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    lab_id TEXT NOT NULL,
    task_id TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempt_grants_lookup ON attempt_grants(tenant_id, tg_id, lab_id, task_id);

CREATE TABLE IF NOT EXISTS results (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    lab_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    score TEXT,
    passed INTEGER,
    failed INTEGER,
    total INTEGER,
    details JSONB NOT NULL DEFAULT '[]'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_results_lookup ON results(tenant_id, tg_id, lab_id, task_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS api_access_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    email TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_access_email ON api_access_log(tenant_id, email);

CREATE TABLE IF NOT EXISTS diagnostic_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    lab_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    check_id TEXT NOT NULL,
    failure_taxonomy TEXT NOT NULL DEFAULT 'unclassified',
    diagnostic_status TEXT NOT NULL DEFAULT 'missing',
    vm_snapshot_status TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diag_events_lookup
    ON diagnostic_events(tenant_id, lab_id, task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assignments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    llm_spec_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_tenant_code ON assignments(tenant_id, code);

CREATE TABLE IF NOT EXISTS conversation_threads (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    student_tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    teacher_tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threads_tenant_lookup
    ON conversation_threads(tenant_id, student_tg_id, teacher_tg_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    thread_id BIGINT NOT NULL REFERENCES conversation_threads(id),
    sender_role TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created
    ON conversation_messages(tenant_id, thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES universities(id),
    tg_id BIGINT NOT NULL REFERENCES users(tg_id),
    assignment_code TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    source TEXT NOT NULL DEFAULT 'telegram',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    result_text TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_lookup
    ON assignment_submissions(tenant_id, tg_id, assignment_code, created_at DESC);
