-- Migration: Créer la table Interventions
-- Description: Journal des interventions (planifiées et non planifiées)
-- Date: 2026-02-12

CREATE TABLE IF NOT EXISTS `Interventions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plannedDate` DATE NOT NULL COMMENT 'Date de l\'intervention',
  `alarmCode` VARCHAR(50) DEFAULT NULL COMMENT 'Code de l\'alarme (X003, Shuttle 67, etc.)',
  `description` TEXT DEFAULT NULL COMMENT 'Description de l\'intervention',
  `startTime` TIME DEFAULT NULL COMMENT 'Heure de début',
  `endTime` TIME DEFAULT NULL COMMENT 'Heure de fin',
  `comment` TEXT DEFAULT NULL COMMENT 'Commentaire sur l\'intervention',
  `isPlanned` BOOLEAN DEFAULT FALSE COMMENT 'true = intervention planifiée (maintenance), false = non planifiée (panne)',
  `createdBy` VARCHAR(100) NOT NULL COMMENT 'Utilisateur qui a créé l\'entrée',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('pending', 'validated', 'ignored') DEFAULT 'pending' COMMENT 'Statut de l\'intervention',
  `validatedAt` DATETIME DEFAULT NULL COMMENT 'Date de validation',
  `validatedBy` VARCHAR(100) DEFAULT NULL COMMENT 'Utilisateur qui a validé',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_planned_date` (`plannedDate`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_by` (`createdBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Journal des interventions (planifiées et non planifiées)';
