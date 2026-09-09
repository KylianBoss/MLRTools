-- Migration: Créer les tables Reports, ReportBlocks, UserReports
-- Description: Système de rapports KPI configurables. Un rapport est défini par
--              une liste ordonnée de blocs de contenu (statiques ou référençant
--              un ZoneGroup/CustomChart existant). Un utilisateur peut être
--              abonné à plusieurs rapports (many-to-many via UserReports).
-- Date: 2026-09-08

CREATE TABLE IF NOT EXISTS `Reports` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT 'Nom affiché du rapport, ex: Rapport Essentiel',
  `slug` VARCHAR(50) NOT NULL COMMENT 'Dérivé du nom (kebab-case), utilisé dans le nom du fichier PDF',
  `description` TEXT DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Si false, jamais généré ni envoyé par le cron sendKPI',
  `createdBy` INT UNSIGNED DEFAULT NULL COMMENT 'ID de l''utilisateur qui a créé le rapport',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_reports_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Rapports KPI configurables (variantes du rapport quotidien)';

CREATE TABLE IF NOT EXISTS `ReportBlocks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reportId` INT UNSIGNED NOT NULL,
  `blockType` ENUM('caseCrashes', 'sevenDaysAverage', 'zoneGroup', 'customChart', 'plannedInterventions', 'unplannedInterventions') NOT NULL,
  `refId` VARCHAR(50) DEFAULT NULL COMMENT 'zoneGroupName ou CustomChart.id stringifié ; NULL pour les blocs statiques',
  `order` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Ordre du bloc dans le rapport, utilisé pour le tri',
  `config` JSON DEFAULT NULL COMMENT 'Réservé pour des paramètres futurs par bloc, non utilisé au lancement',
  PRIMARY KEY (`id`),
  INDEX `idx_reportblocks_report_order` (`reportId`, `order`),
  CONSTRAINT `fk_reportblocks_report` FOREIGN KEY (`reportId`) REFERENCES `Reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blocs de contenu ordonnés composant chaque rapport';

CREATE TABLE IF NOT EXISTS `UserReports` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` INT UNSIGNED NOT NULL,
  `reportId` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_userreports_user_report` (`userId`, `reportId`),
  CONSTRAINT `fk_userreports_report` FOREIGN KEY (`reportId`) REFERENCES `Reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Abonnements many-to-many utilisateur <-> rapport';
