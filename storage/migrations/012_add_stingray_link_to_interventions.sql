-- Migration: Ajouter le lien Stingray sur Interventions
-- Description: Permet de rattacher une intervention existante à un stingray
--              de façon structurée (en plus du champ alarmCode en texte libre)
--              et de tracer le changement d'état associé. Dépend de 011.
-- Date: 2026-08-20

ALTER TABLE `Interventions`
  ADD COLUMN `stingrayId` INT UNSIGNED DEFAULT NULL COMMENT 'Stingray concerné, si applicable' AFTER `alarmCode`,
  ADD COLUMN `newState` ENUM('in_service', 'maintenance', 'out_of_service', 'spare') DEFAULT NULL COMMENT 'Nouvel état du stingray suite à cette intervention' AFTER `stingrayId`,
  ADD CONSTRAINT `fk_intervention_stingray` FOREIGN KEY (`stingrayId`) REFERENCES `Stingrays` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD INDEX `idx_intervention_stingray` (`stingrayId`);
