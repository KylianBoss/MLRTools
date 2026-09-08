-- Migration: Add options column to CronJobs table
-- Purpose: Store job-specific options as JSON (e.g., sendEmail for SendKPI)
-- Date: 2026-02-03

-- Add options column
ALTER TABLE CronJobs ADD COLUMN options JSON DEFAULT NULL;

-- Add comment
ALTER TABLE CronJobs MODIFY COLUMN options JSON DEFAULT NULL COMMENT 'Job-specific options stored as JSON, e.g. {sendEmail: true} for SendKPI';

-- Update SendKPI job with default options (send email by default)
UPDATE CronJobs
SET options = JSON_OBJECT('sendEmail', true)
WHERE jobName = 'sendKPI' AND options IS NULL;
