-- Migration: Créer les tables Stingrays, Aisles, StingrayPositionHistories
-- Description: Référentiel des stingrays, des allées du shuttle, et historique
--              des positions. Seed des 6 allées et des seuils d'alarme configurables.
-- Date: 2026-08-20

CREATE TABLE IF NOT EXISTS `Aisles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(20) NOT NULL COMMENT 'Nom de l''allée, ex: Allée 1',
  `floorsCount` INT UNSIGNED NOT NULL DEFAULT 28 COMMENT 'Nombre d''étages de l''allée',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_aisle_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Les 6 allées du shuttle (28 étages chacune)';

INSERT IGNORE INTO `Aisles` (`name`, `floorsCount`) VALUES
  ('Allée 1', 28),
  ('Allée 2', 28),
  ('Allée 3', 28),
  ('Allée 4', 28),
  ('Allée 5', 28),
  ('Allée 6', 28);

CREATE TABLE IF NOT EXISTS `Stingrays` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `number` INT UNSIGNED NOT NULL COMMENT 'Numéro physique du stingray, correspond au Shuttle N du Datalog',
  `serialNumber` VARCHAR(255) DEFAULT NULL,
  `state` ENUM('in_service', 'maintenance', 'out_of_service', 'spare') NOT NULL DEFAULT 'spare' COMMENT 'État courant du stingray',
  `currentAisleId` INT UNSIGNED DEFAULT NULL COMMENT 'Dénormalisé depuis la dernière position en allée, NULL si pas en allée',
  `currentFloor` INT UNSIGNED DEFAULT NULL COMMENT 'Étage courant (1-28), dénormalisé, NULL si pas en allée',
  `notes` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_stingray_number` (`number`),
  INDEX `idx_stingray_state` (`state`),
  CONSTRAINT `fk_stingray_current_aisle` FOREIGN KEY (`currentAisleId`) REFERENCES `Aisles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Référentiel des stingrays du parc';

CREATE TABLE IF NOT EXISTS `StingrayPositionHistories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `stingrayId` INT UNSIGNED NOT NULL,
  `aisleId` INT UNSIGNED DEFAULT NULL COMMENT 'NULL = atelier/stock/hors service',
  `floor` INT UNSIGNED DEFAULT NULL COMMENT 'Étage (1-28), NULL si aisleId est NULL',
  `locationLabel` VARCHAR(50) DEFAULT NULL COMMENT 'Libellé libre pour les positions hors-allée, ex: Atelier',
  `movedAt` DATETIME NOT NULL COMMENT 'Date d''entrée à cette position',
  `movedBy` INT UNSIGNED DEFAULT NULL,
  `comment` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_position_stingray_moved` (`stingrayId`, `movedAt`),
  INDEX `idx_position_aisle_floor` (`aisleId`, `floor`),
  CONSTRAINT `fk_position_stingray` FOREIGN KEY (`stingrayId`) REFERENCES `Stingrays` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_position_aisle` FOREIGN KEY (`aisleId`) REFERENCES `Aisles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_position_mover` FOREIGN KEY (`movedBy`) REFERENCES `Users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Historique append-only des positions des stingrays';

-- Seed des seuils d'alarme configurables (pattern Settings existant)
INSERT IGNORE INTO `Settings` (`key`, `value`, `description`, `updatedAt`) VALUES
  ('STINGRAY_ALARM_WINDOW_DAYS', '30', 'Fenêtre glissante (jours) pour le calcul du niveau d''alarme des stingrays', NOW()),
  ('STINGRAY_ALARM_WARN_THRESHOLD', '5', 'Score d''alarme à partir duquel un stingray passe en niveau attention', NOW()),
  ('STINGRAY_ALARM_CRITICAL_THRESHOLD', '15', 'Score d''alarme à partir duquel un stingray passe en niveau critique', NOW());
