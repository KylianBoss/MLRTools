-- Migration: Add scheduledFor column to JobQueue table
-- Date: 2026-02-02
-- Description: Add scheduledFor column to allow delayed job execution (e.g., retry delays)

ALTER TABLE JobQueue
ADD COLUMN scheduledFor DATETIME DEFAULT NULL COMMENT 'Timestamp when the job should be executed (NULL for immediate execution)' AFTER createdAt;

-- Update existing records to have immediate execution
UPDATE JobQueue SET scheduledFor = createdAt WHERE scheduledFor IS NULL;

-- Add index for efficient polling
CREATE INDEX idx_status_scheduled ON JobQueue(status, scheduledFor);
