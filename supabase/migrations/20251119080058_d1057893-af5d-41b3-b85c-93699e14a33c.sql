-- Add duration_seconds column to cached_videos table
ALTER TABLE cached_videos ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT 0;