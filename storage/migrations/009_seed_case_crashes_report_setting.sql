-- Migration: Ajouter le paramètre CASE_CRASHES_REPORT_DAYS
-- Description: Nombre de jours d'historique affichés pour le tableau des chutes
--              de tours de caisses dans le rapport KPI quotidien
-- Date: 2026-07-22

INSERT INTO `Settings` (`key`, `value`, `description`, `updatedAt`)
SELECT 'CASE_CRASHES_REPORT_DAYS', '30',
       'Nombre de jours d\'historique affichés pour le tableau des chutes de tours de caisses dans le rapport KPI quotidien',
       NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Settings` WHERE `key` = 'CASE_CRASHES_REPORT_DAYS'
);
