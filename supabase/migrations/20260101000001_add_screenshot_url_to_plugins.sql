-- Add screenshot_url column to plugins table
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS screenshot_url TEXT DEFAULT '';
