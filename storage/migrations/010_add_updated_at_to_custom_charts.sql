-- Migration: Ajouter la colonne updatedAt à CustomCharts
-- Description: Permet d'afficher la date de dernière modification d'un
--              graphique personnalisé (édition ou régénération du cache)
-- Date: 2026-08-14

ALTER TABLE `CustomCharts`
  ADD COLUMN IF NOT EXISTS `updatedAt` DATETIME NULL
  COMMENT 'Last time the chart or its cached data was modified';

UPDATE `CustomCharts` SET `updatedAt` = NOW() WHERE `updatedAt` IS NULL;
