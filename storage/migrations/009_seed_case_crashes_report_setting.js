import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Seed CASE_CRASHES_REPORT_DAYS setting
 * Date: 2026-07-22
 *
 * Ajoute le paramètre configurable qui définit sur combien de jours
 * le tableau des chutes de tours de caisses est calculé dans le
 * rapport KPI quotidien (PDF).
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Seeding setting: CASE_CRASHES_REPORT_DAYS...");

    const [existing] = await queryInterface.sequelize.query(
      "SELECT `key` FROM `Settings` WHERE `key` = 'CASE_CRASHES_REPORT_DAYS'",
      { transaction }
    );

    if (existing.length === 0) {
      await queryInterface.bulkInsert(
        "Settings",
        [
          {
            key: "CASE_CRASHES_REPORT_DAYS",
            value: "30",
            description:
              "Nombre de jours d'historique affichés pour le tableau des chutes de tours de caisses dans le rapport KPI quotidien",
            updatedAt: new Date(),
          },
        ],
        { transaction }
      );
      console.log("Setting CASE_CRASHES_REPORT_DAYS created (30 days).");
    } else {
      console.log("Setting CASE_CRASHES_REPORT_DAYS already exists, skipping.");
    }

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
    console.log("Rolling back: Remove CASE_CRASHES_REPORT_DAYS setting...");
    await queryInterface.bulkDelete(
      "Settings",
      { key: "CASE_CRASHES_REPORT_DAYS" },
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
