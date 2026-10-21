-- Migration: Add index on Datalogs.timeOfOccurence
-- Date: 2026-10-21
-- Référence humaine de la migration équivalente (026_add_time_of_occurence_index_to_datalogs.js).
-- Non exécuté par sequelize-cli.

CREATE INDEX idx_time_of_occurence ON Datalogs (timeOfOccurence);
