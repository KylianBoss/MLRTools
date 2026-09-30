-- Migration: Corrige le type de AUTO_GROUP_DATASOURCE_GAP et
--            AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION en 'duration'
-- Description: Omises de la classification faite par la migration 022 bien
--              que déjà en valeur texte ("5 min", "10 min") depuis la 021
-- Date: 2026-09-29

UPDATE `Settings` SET `type` = 'duration'
WHERE `key` IN ('AUTO_GROUP_DATASOURCE_GAP', 'AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION');
