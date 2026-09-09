-- Migration: Create JobQueue table
-- Date: 2026-02-02
-- Description: Create a queue table for asynchronous job execution requests

CREATE TABLE IF NOT EXISTS JobQueue (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'Unique identifier for the job queue entry',
  jobName VARCHAR(255) NOT NULL COMMENT 'Name of the job to execute',
  action VARCHAR(255) NOT NULL COMMENT 'Action to be performed',
  args JSON DEFAULT NULL COMMENT 'Arguments to pass to the job',
  requestedBy INT UNSIGNED NOT NULL COMMENT 'User ID who requested the job',
  status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending' COMMENT 'Current status of the job',
  error TEXT DEFAULT NULL COMMENT 'Error message if job failed',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when the job was requested',
  startedAt DATETIME DEFAULT NULL COMMENT 'Timestamp when the job started executing',
  completedAt DATETIME DEFAULT NULL COMMENT 'Timestamp when the job completed',

  INDEX idx_status_created (status, createdAt),
  INDEX idx_action (action),

  CONSTRAINT fk_jobqueue_user
    FOREIGN KEY (requestedBy)
    REFERENCES Users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Queue for asynchronous job execution requests';
