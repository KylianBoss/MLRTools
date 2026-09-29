-- Migration: Renomme AUTO_GROUP_DATASOURCE_GAP_MS et
--            AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S vers le système
--            harmonisé de settings "durée" (valeur textuelle, plus d'unité
--            dans le nom de clé ni la description).
-- Date: 2026-09-29

INSERT INTO `Settings` (`key`, `value`, `description`, `updatedAt`)
SELECT 'AUTO_GROUP_DATASOURCE_GAP', '5 min',
       'Groupement automatique des alarmes (étape par datasource) : écart maximal toléré entre deux alarmes pour qu\'elles soient regroupées ensemble',
       NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Settings` WHERE `key` = 'AUTO_GROUP_DATASOURCE_GAP'
);

DELETE FROM `Settings` WHERE `key` = 'AUTO_GROUP_DATASOURCE_GAP_MS';

INSERT INTO `Settings` (`key`, `value`, `description`, `updatedAt`)
SELECT 'AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION', '10 min',
       'Groupement automatique des alarmes (étape par datasource) : durée maximale d\'une alarme individuelle pour qu\'elle participe au groupement ; au-delà, elle est exclue pour ne pas fusionner des heures d\'alarmes sans rapport',
       NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Settings` WHERE `key` = 'AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION'
);

DELETE FROM `Settings` WHERE `key` = 'AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S';
