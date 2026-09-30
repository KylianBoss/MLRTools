-- Migration: Ajouter la colonne `type` à Settings + classifier toutes les
--            clés existantes + convertir les valeurs "duration" en texte
--            lisible
-- Description: 'text' (libre), 'number' (valeur numérique), 'date' (date
--              ISO), 'duration' (texte de durée "5 min"/"10 sec"/"7 jours"
--              validé par settingsDuration.js), 'secret' (valeur sensible
--              affichée masquée dans la page Settings admin)
-- Date: 2026-09-29

ALTER TABLE `Settings`
  ADD COLUMN `type` ENUM('text', 'number', 'date', 'duration', 'secret') NOT NULL DEFAULT 'text'
  COMMENT '''text''=libre, ''number''=numérique, ''date''=date ISO, ''duration''=texte de durée validé par settingsDuration.js, ''secret''=valeur sensible affichée masquée';

-- Type 'number'
UPDATE `Settings` SET `type` = 'number'
WHERE `key` IN (
  'CHART_X_TICK_AMOUNT',
  'MIN_PROD_TO_TAKE',
  'STINGRAY_ALARM_CRITICAL_THRESHOLD',
  'STINGRAY_ALARM_WARN_THRESHOLD'
);

-- Type 'date'
UPDATE `Settings` SET `type` = 'date'
WHERE `key` IN ('dailyAnalysisDoneDate', 'MIN_DATE');

-- Type 'secret'
UPDATE `Settings` SET `type` = 'secret'
WHERE `key` IN ('cloudflareTunnelToken', 'botApiKey', 'APP_2FA_SECRET');

-- Type 'duration' + conversion de la valeur brute vers un texte lisible.
-- Le nom de clé et la description ne portent plus l'unité après cette
-- migration. CUSTOM_CHART_WINDOW est convertie telle quelle (365000 jours)
-- malgré l'incohérence apparente avec sa description d'origine, à la
-- demande explicite (pas de correction silencieuse d'une valeur en prod).
--
-- MIN_ALARM_DURATION est volontairement EXCLUE : elle est lue directement
-- en SQL par 3 procédures stockées (getChartData, getKPICount,
-- getTop10AlarmsWithDailyBreakdown) via un cast implicite VARCHAR->INT qui
-- échouerait sous sql_mode STRICT_TRANS_TABLES avec un texte "30 sec". Ces
-- procédures doivent être mises à jour pour parser explicitement AVANT de
-- migrer cette clé.
UPDATE `Settings` SET `type` = 'duration', `value` = '30 jours'  WHERE `key` = 'CASE_CRASHES_REPORT_DAYS';
UPDATE `Settings` SET `type` = 'duration', `value` = '7 jours'   WHERE `key` = 'GRAPH_TABLE_WINDOW';
UPDATE `Settings` SET `type` = 'duration', `value` = '250 jours' WHERE `key` = 'GRAPH_WINDOW';
UPDATE `Settings` SET `type` = 'duration', `value` = '7 jours'   WHERE `key` = 'MOVING_AVERAGE_WINDOW';
UPDATE `Settings` SET `type` = 'duration', `value` = '30 jours'  WHERE `key` = 'STINGRAY_ALARM_WINDOW_DAYS';
UPDATE `Settings` SET `type` = 'duration', `value` = '365000 jours' WHERE `key` = 'CUSTOM_CHART_WINDOW';
