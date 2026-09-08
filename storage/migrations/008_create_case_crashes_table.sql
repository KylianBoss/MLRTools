-- Migration: Créer les tables CaseCrashes et CaseCrashTypes
-- Description: Enregistrement manuel des chutes de tours de caisses (date, zone, types de caisses)
-- Date: 2026-07-22

CREATE TABLE IF NOT EXISTS `CaseCrashes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `crashDate` DATE NOT NULL COMMENT 'Date de la chute de la tour de caisses',
  `zone` ENUM('F013', 'X001', 'X002', 'X003', 'X101', 'X102', 'X103', 'X104') NOT NULL COMMENT 'Zone où la chute a eu lieu',
  `createdBy` INT UNSIGNED NOT NULL COMMENT 'Utilisateur qui a créé l\'entrée',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_case_crash_date` (`crashDate`),
  INDEX `idx_case_crash_zone` (`zone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Chutes de tours de caisses enregistrées manuellement';

CREATE TABLE IF NOT EXISTS `CaseCrashTypes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `caseCrashId` INT NOT NULL,
  `caseType` ENUM('A', 'B', 'C', 'E', 'H', 'U') NOT NULL COMMENT 'Type de caisse présent dans la tour',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_case_crash_type_unique` (`caseCrashId`, `caseType`),
  CONSTRAINT `fk_case_crash_type_crash` FOREIGN KEY (`caseCrashId`) REFERENCES `CaseCrashes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Types de caisses présents lors d\'une chute de tour';
