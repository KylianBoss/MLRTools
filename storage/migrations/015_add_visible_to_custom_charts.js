import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add visible column to CustomCharts table
 * Date: 2026-09-08
 *
 * Ajoute la colonne visible sur CustomCharts pour permettre de masquer un
 * graphique personnalisé du dashboard (FailluresChartsPage) sans le
 * supprimer ni perdre son cache/historique.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add visible column to CustomCharts...");

    const tableDescription = await queryInterface.describeTable("CustomCharts");

    if (!tableDescription.visible) {
      console.log("Adding column: visible");
      await queryInterface.addColumn(
        "CustomCharts",
        "visible",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: "Whether the chart is shown on the dashboard (kept in DB when hidden)",
        },
        { transaction }
      );
    } else {
      console.log("Column visible already exists, skipping...");
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
    console.log("Rolling back migration: Remove visible column from CustomCharts...");

    const tableDescription = await queryInterface.describeTable("CustomCharts");

    if (tableDescription.visible) {
      await queryInterface.removeColumn("CustomCharts", "visible", {
        transaction,
      });
      console.log("Column visible removed");
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
