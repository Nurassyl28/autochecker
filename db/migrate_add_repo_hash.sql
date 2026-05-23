-- Add repo_hash column to cache grading by content, not URL
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS repo_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_submissions_repo_hash ON submissions(assignment_id, repo_hash) WHERE status = 'done';
