-- Migration: Add alarm analysis columns to Datalogs table and remove TranslatedAlarms view
-- Date: 2026-02-10
-- Description: 
--   1. Add x_state, x_group, x_treated, x_comment columns to Datalogs
--   2. Drop TranslatedAlarms view if it exists

-- Add columns to Datalogs table if they don't exist
ALTER TABLE mwnz_MLR.Datalogs 
ADD COLUMN IF NOT EXISTS x_state ENUM('unplanned', 'planned') DEFAULT 'unplanned' 
    COMMENT 'State of alarm: unplanned (default) or planned maintenance',
ADD COLUMN IF NOT EXISTS x_group INT DEFAULT NULL 
    COMMENT 'Group ID for related alarms that should be counted as one',
ADD COLUMN IF NOT EXISTS x_treated BOOLEAN DEFAULT FALSE 
    COMMENT 'Whether alarm has been reviewed/treated',
ADD COLUMN IF NOT EXISTS x_comment TEXT DEFAULT NULL 
    COMMENT 'Comment/notes about the alarm';

-- Add index on x_group for better performance on group queries
CREATE INDEX IF NOT EXISTS idx_x_group ON mwnz_MLR.Datalogs(x_group);

-- Add index on x_state for better filtering performance
CREATE INDEX IF NOT EXISTS idx_x_state ON mwnz_MLR.Datalogs(x_state);

-- Drop TranslatedAlarms view if it exists
DROP VIEW IF EXISTS mwnz_MLR.TranslatedAlarms;

-- Note: After running this migration, you should update all stored procedures
-- that reference TranslatedAlarms to use Datalogs with JOIN on Alarms instead.
