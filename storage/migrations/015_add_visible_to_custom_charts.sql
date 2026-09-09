-- Migration: Ajouter la colonne visible à CustomCharts
-- Description: Permet de masquer un graphique personnalisé du dashboard
--              (FailluresChartsPage) sans le supprimer ni perdre son cache
-- Date: 2026-09-08

ALTER TABLE `CustomCharts`
  ADD COLUMN IF NOT EXISTS `visible` TINYINT(1) NOT NULL DEFAULT 1
  COMMENT 'Whether the chart is shown on the dashboard (kept in DB when hidden)';
