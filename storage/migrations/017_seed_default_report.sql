-- Migration: Seed du rapport par défaut "Rapport quotidien"
-- Description: Crée un rapport reprenant l'ordre exact des sections
--              actuellement codées en dur dans generateKPIPDF() : chutes de
--              tours de caisses, moyenne 7 jours, un bloc par ZoneGroup
--              affiché (dans son ordre actuel), un bloc par CustomChart
--              visible, puis interventions planifiées/non-planifiées.
--
--              IMPORTANT : ne crée AUCUN abonnement dans UserReports.
--              Décision utilisateur explicite : les destinataires du rapport
--              quotidien sont reconfigurés manuellement depuis l'UI
--              (UsersSettings.vue) après déploiement, pas de migration
--              automatique depuis Users.recieveDailyReport. Conséquence :
--              aucun email KPI ne sera envoyé tant que les abonnements
--              n'auront pas été reconfigurés manuellement.
-- Date: 2026-09-08

-- Idempotent : ne fait rien si le rapport par défaut existe déjà.
INSERT INTO `Reports` (`name`, `slug`, `description`, `active`, `createdBy`, `createdAt`, `updatedAt`)
SELECT
  'Rapport quotidien',
  'rapport-quotidien',
  'Rapport historique migré automatiquement, reprend l''ordre des sections précédemment codées en dur.',
  1,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Reports` WHERE `slug` = 'rapport-quotidien'
);

-- Blocs statiques (ordre 0-1) : chutes de tours de caisses, moyenne 7 jours.
-- N'insère que si le rapport vient d'être créé par ce script (ses blocs sont
-- absents), pour rester idempotent sur une ré-exécution.
INSERT INTO `ReportBlocks` (`reportId`, `blockType`, `refId`, `order`)
SELECT r.id, 'caseCrashes', NULL, 0
FROM `Reports` r
WHERE r.slug = 'rapport-quotidien'
  AND NOT EXISTS (SELECT 1 FROM `ReportBlocks` WHERE `reportId` = r.id);

INSERT INTO `ReportBlocks` (`reportId`, `blockType`, `refId`, `order`)
SELECT r.id, 'sevenDaysAverage', NULL, 1
FROM `Reports` r
WHERE r.slug = 'rapport-quotidien'
  AND (SELECT COUNT(*) FROM `ReportBlocks` WHERE `reportId` = r.id) = 1;

-- Un bloc par ZoneGroup affiché, dans son ordre actuel (order commence à 2).
INSERT INTO `ReportBlocks` (`reportId`, `blockType`, `refId`, `order`)
SELECT
  r.id,
  'zoneGroup',
  zg.`zoneGroupName`,
  2 + (
    SELECT COUNT(*)
    FROM `ZoneGroups` zg2
    WHERE zg2.`display` = 1 AND zg2.`order` < zg.`order`
  )
FROM `Reports` r
CROSS JOIN `ZoneGroups` zg
WHERE r.slug = 'rapport-quotidien'
  AND zg.`display` = 1
  AND (SELECT COUNT(*) FROM `ReportBlocks` WHERE `reportId` = r.id) = 2;

-- Un bloc par CustomChart visible, ordonné par id (aucun tri actuel).
INSERT INTO `ReportBlocks` (`reportId`, `blockType`, `refId`, `order`)
SELECT
  r.id,
  'customChart',
  CAST(cc.`id` AS CHAR),
  2 + (SELECT COUNT(*) FROM `ZoneGroups` WHERE `display` = 1) + (
    SELECT COUNT(*)
    FROM `CustomCharts` cc2
    WHERE cc2.`visible` = 1 AND cc2.`id` < cc.`id`
  )
FROM `Reports` r
CROSS JOIN `CustomCharts` cc
WHERE r.slug = 'rapport-quotidien'
  AND cc.`visible` = 1
  AND (SELECT COUNT(*) FROM `ReportBlocks` WHERE `reportId` = r.id) = 2 + (SELECT COUNT(*) FROM `ZoneGroups` WHERE `display` = 1);

-- Blocs statiques finaux : interventions planifiées puis non-planifiées.
INSERT INTO `ReportBlocks` (`reportId`, `blockType`, `refId`, `order`)
SELECT
  r.id,
  'plannedInterventions',
  NULL,
  2 + (SELECT COUNT(*) FROM `ZoneGroups` WHERE `display` = 1) + (SELECT COUNT(*) FROM `CustomCharts` WHERE `visible` = 1)
FROM `Reports` r
WHERE r.slug = 'rapport-quotidien'
  AND (SELECT COUNT(*) FROM `ReportBlocks` WHERE `reportId` = r.id) = 2 + (SELECT COUNT(*) FROM `ZoneGroups` WHERE `display` = 1) + (SELECT COUNT(*) FROM `CustomCharts` WHERE `visible` = 1);

INSERT INTO `ReportBlocks` (`reportId`, `blockType`, `refId`, `order`)
SELECT
  r.id,
  'unplannedInterventions',
  NULL,
  3 + (SELECT COUNT(*) FROM `ZoneGroups` WHERE `display` = 1) + (SELECT COUNT(*) FROM `CustomCharts` WHERE `visible` = 1)
FROM `Reports` r
WHERE r.slug = 'rapport-quotidien'
  AND (SELECT COUNT(*) FROM `ReportBlocks` WHERE `reportId` = r.id) = 3 + (SELECT COUNT(*) FROM `ZoneGroups` WHERE `display` = 1) + (SELECT COUNT(*) FROM `CustomCharts` WHERE `visible` = 1);

-- Aucun INSERT dans UserReports : les abonnements sont reconfigurés manuellement.
