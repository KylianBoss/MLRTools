-- Migration: Renommer les allées au format W00N
-- Description: Allée 1 -> W001, Allée 2 -> W002, ..., Allée 6 -> W006
-- Date: 2026-08-25

UPDATE `Aisles` SET `name` = 'W001' WHERE `name` = 'Allée 1';
UPDATE `Aisles` SET `name` = 'W002' WHERE `name` = 'Allée 2';
UPDATE `Aisles` SET `name` = 'W003' WHERE `name` = 'Allée 3';
UPDATE `Aisles` SET `name` = 'W004' WHERE `name` = 'Allée 4';
UPDATE `Aisles` SET `name` = 'W005' WHERE `name` = 'Allée 5';
UPDATE `Aisles` SET `name` = 'W006' WHERE `name` = 'Allée 6';
