-- Migration: Ajouter la colonne 'result' à JobQueue
-- Description: Permet à un job traité par le PC BOT (seule instance connectée
--              au réseau MVN/Oracle) de renvoyer un résultat riche (ex: lignes
--              d'un SELECT) vers l'instance qui l'a demandé, pas seulement un
--              message d'erreur. Utilisé par l'action 'executeMvnQuery'.
-- Date: 2026-09-14

ALTER TABLE `JobQueues`
  ADD COLUMN IF NOT EXISTS `result` JSON NULL
  COMMENT 'Résultat du job (ex: lignes retournées par une requête MVN)';
