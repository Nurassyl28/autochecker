-- Bind assignments to a specific class (NULL = visible to all)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
