import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Corrige le type de AUTO_GROUP_DATASOURCE_GAP et
 * AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION en 'duration'
 * Date: 2026-09-29
 *
 * La migration 022 (ajout de Settings.type) a classifié toutes les clés
 * existantes mais a omis ces deux-là — déjà migrées en valeur texte
 * ("5 min", "10 min") par la migration 021, mais laissées au type par
 * défaut 'text' faute d'avoir été incluses dans sa liste DURATION_VALUES.
 */

const KEYS = ["AUTO_GROUP_DATASOURCE_GAP", "AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION"];

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Marking AUTO_GROUP_DATASOURCE_GAP and AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION as 'duration'...");
    await queryInterface.bulkUpdate("Settings", { type: "duration" }, { key: KEYS }, { transaction });
    await transaction.commit();
    console.log("Migration completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function down(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Reverting AUTO_GROUP_DATASOURCE_GAP and AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION to 'text'...");
    await queryInterface.bulkUpdate("Settings", { type: "text" }, { key: KEYS }, { transaction });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
