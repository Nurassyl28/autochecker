-- Add reference_solution to assignments so teachers can upload correct answer
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS reference_solution TEXT;
