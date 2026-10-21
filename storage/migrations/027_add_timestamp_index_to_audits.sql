-- Migration: Add index on Audits.timestamp
-- Date: 2026-10-21
-- Référence humaine de la migration équivalente (027_add_timestamp_index_to_audits.js).
-- Non exécuté par sequelize-cli.

CREATE INDEX idx_audits_timestamp ON Audits (timestamp);
