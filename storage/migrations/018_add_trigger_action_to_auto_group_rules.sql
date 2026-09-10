-- Migration: Ajouter l'action 'trigger' + triggerAlarmId + windowAfterMs à AutoGroupRules
-- Description: Une alarme déclencheuse identifiée par son alarmId exact (ex:
--              interrupteur à clé, peu importe son type/classification) capture
--              toutes les alarmes d'une zone (paires précises dataSource+alarmArea)
--              sur toute la durée de l'incident, plus une marge après sa clôture.
-- Date: 2026-09-10

ALTER TABLE `AutoGroupRules`
  ADD COLUMN IF NOT EXISTS `windowAfterMs` INT UNSIGNED NULL DEFAULT 120000
  COMMENT 'Marge en ms après la clôture de l''alarme déclencheuse pendant laquelle les alarmes de zone sont capturées (action = trigger). Défaut 2 minutes.';

ALTER TABLE `AutoGroupRules`
  ADD COLUMN IF NOT EXISTS `triggerAlarmId` VARCHAR(255) NULL
  COMMENT 'alarmId exact et unique (table Alarms) de l''alarme déclencheuse, peu importe son type (human inclus). Utilisé uniquement si action = trigger.';

ALTER TABLE `AutoGroupRules`
  MODIFY COLUMN `action` ENUM('group', 'treat', 'trigger') NOT NULL DEFAULT 'group'
  COMMENT '''group'' = grouper les alarmes, ''treat'' = marquer comme traitées sans grouper, ''trigger'' = capturer toutes les alarmes d''une zone pendant qu''une alarme déclencheuse est active + une marge';

ALTER TABLE `AutoGroupRules`
  MODIFY COLUMN `keyword` VARCHAR(255) NULL
  COMMENT 'Mot-clé à chercher dans alarmText (insensible à la casse). Non utilisé si action = trigger';

ALTER TABLE `AutoGroupRules`
  MODIFY COLUMN `zone` JSON NULL
  COMMENT 'Si groupBy = zone: array de dataSources (string[]). Si action = trigger: array de paires precises {dataSource, alarmArea}.';
