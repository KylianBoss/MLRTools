-- Migration: Ajouter 'alarmsByHour' à l'ENUM ReportBlocks.blockType
-- Description: Nouveau bloc de rapport statique (aucun refId) : nombre de
--              pannes prio (type = 'primary' ou NULL, table Alarms)
--              réparties par heure de la journée (0-23h), sur la journée
--              précédente.
-- Date: 2026-09-14

ALTER TABLE `ReportBlocks`
  MODIFY COLUMN `blockType` ENUM(
    'caseCrashes',
    'sevenDaysAverage',
    'zoneGroup',
    'customChart',
    'plannedInterventions',
    'unplannedInterventions',
    'alarmsByHour'
  ) NOT NULL;
