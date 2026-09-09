-- Migration: Allow NULL for requestedBy in JobQueue
-- Date: 2026-05-11
-- Description: Les jobs créés automatiquement par les crons n'ont pas d'utilisateur,
--              requestedBy doit être nullable. Suppression de la FK et de la contrainte NOT NULL.

ALTER TABLE JobQueue
  DROP FOREIGN KEY fk_jobqueue_user,
  MODIFY COLUMN requestedBy INT UNSIGNED NULL DEFAULT NULL COMMENT 'User ID who requested the job, NULL for automatic cron jobs';

ALTER TABLE JobQueue
  ADD CONSTRAINT fk_jobqueue_user
    FOREIGN KEY (requestedBy)
    REFERENCES Users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
