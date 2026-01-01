-- Add screenshot_url column to themes table
ALTER TABLE themes ADD COLUMN IF NOT EXISTS screenshot_url TEXT DEFAULT '';
