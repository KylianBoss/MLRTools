-- Migration: Ajouter les paramètres AUTO_GROUP_DATASOURCE_GAP_MS et
--            AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S
-- Description: Écart temporel maximal et durée maximale d'alarme individuelle
--              utilisés par l'étape de groupement automatique par datasource
--              (storage/services/autoGroupAlarms.js)
-- Date: 2026-09-29

INSERT INTO `Settings` (`key`, `value`, `description`, `updatedAt`)
SELECT 'AUTO_GROUP_DATASOURCE_GAP_MS', '300000',
       'Groupement automatique des alarmes (étape par datasource) : écart maximal en millisecondes entre deux alarmes pour qu\'elles soient regroupées ensemble (défaut 300000 = 5 minutes)',
       NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Settings` WHERE `key` = 'AUTO_GROUP_DATASOURCE_GAP_MS'
);

INSERT INTO `Settings` (`key`, `value`, `description`, `updatedAt`)
SELECT 'AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S', '600',
       'Groupement automatique des alarmes (étape par datasource) : durée maximale en secondes d\'une alarme individuelle pour qu\'elle participe au groupement ; au-delà, elle est exclue pour ne pas fusionner des heures d\'alarmes sans rapport (défaut 600 = 10 minutes)',
       NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `Settings` WHERE `key` = 'AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S'
);
