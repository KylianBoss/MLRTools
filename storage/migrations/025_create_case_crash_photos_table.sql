-- Migration: Create CaseCrashPhotos table
-- Date: 2026-10-07
-- Référence humaine de la DDL exécutée par 025_create_case_crash_photos_table.js
-- (non exécuté par sequelize-cli, ce fichier .sql n'est que de la documentation)

CREATE TABLE `CaseCrashPhotos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `caseCrashId` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL COMMENT 'Nom du fichier sur disque (storage/case-crashes/<caseCrashId>/<filename>), pas un chemin complet',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `CaseCrashPhotos_caseCrashId_fkey`
    FOREIGN KEY (`caseCrashId`) REFERENCES `CaseCrashes` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX `idx_case_crash_photo_crash_id` ON `CaseCrashPhotos` (`caseCrashId`);
