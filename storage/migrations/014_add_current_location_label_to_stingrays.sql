-- Migration: Ajouter currentLocationLabel sur Stingrays
-- Description: Dénormalise le libellé de l'emplacement hors-allée courant
--              (Maintenance stingray, Stock, TGW...), pour l'affichage direct
--              sans recalculer depuis StingrayPositionHistories.
-- Date: 2026-08-25

ALTER TABLE `Stingrays`
  ADD COLUMN `currentLocationLabel` VARCHAR(50) DEFAULT NULL COMMENT 'Libellé de l''emplacement hors-allée courant, NULL si en allée' AFTER `currentFloor`;
