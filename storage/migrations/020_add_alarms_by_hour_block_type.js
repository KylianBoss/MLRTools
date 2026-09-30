import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add 'alarmsByHour' to ReportBlocks.blockType ENUM
 * Date: 2026-09-14
 *
 * Nouveau bloc de rapport statique (aucun refId) : nombre de pannes prio
 * (type = 'primary' ou NULL, table Alarms) réparties par heure de la
 * journée (0-23h), sur la journée précédente. Voir
 * src-electron/cron/reportBlocks.js#renderAlarmsByHourBlock et
 * storage/getAlarmsByHourOfDay.sql.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add alarmsByHour block type...");

    await queryInterface.changeColumn(
      "ReportBlocks",
      "blockType",
      {
        type: Sequelize.ENUM(
          "caseCrashes",
          "sevenDaysAverage",
          "zoneGroup",
          "customChart",
          "plannedInterventions",
          "unplannedInterventions",
          "alarmsByHour"
        ),
        allowNull: false,
      },
      { transaction }
    );

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
    console.log("Rolling back migration: Remove alarmsByHour block type...");

    // Retire tout bloc alarmsByHour avant de retirer la valeur de l'ENUM
    await queryInterface.sequelize.query(
      "DELETE FROM `ReportBlocks` WHERE `blockType` = 'alarmsByHour'",
      { transaction }
    );

    await queryInterface.changeColumn(
      "ReportBlocks",
      "blockType",
      {
        type: Sequelize.ENUM(
          "caseCrashes",
          "sevenDaysAverage",
          "zoneGroup",
          "customChart",
          "plannedInterventions",
          "unplannedInterventions"
        ),
        allowNull: false,
      },
      { transaction }
    );

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
