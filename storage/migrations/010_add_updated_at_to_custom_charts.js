import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add updatedAt column to CustomCharts table
 * Date: 2026-08-14
 *
 * Ajoute la colonne updatedAt sur CustomCharts pour afficher la date de
 * dernière modification du graphique (édition ou régénération du cache)
 * dans la page de gestion des graphiques personnalisés.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add updatedAt column to CustomCharts...");

    const tableDescription = await queryInterface.describeTable("CustomCharts");

    if (!tableDescription.updatedAt) {
      console.log("Adding column: updatedAt");
      await queryInterface.addColumn(
        "CustomCharts",
        "updatedAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "Last time the chart or its cached data was modified",
        },
        { transaction }
      );

      // Initialise updatedAt avec la date de création connue (NOW à défaut)
      await queryInterface.sequelize.query(
        "UPDATE `CustomCharts` SET `updatedAt` = NOW() WHERE `updatedAt` IS NULL",
        { transaction }
      );
    } else {
      console.log("Column updatedAt already exists, skipping...");
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
    console.log("Rolling back migration: Remove updatedAt column from CustomCharts...");

    const tableDescription = await queryInterface.describeTable("CustomCharts");

    if (tableDescription.updatedAt) {
      await queryInterface.removeColumn("CustomCharts", "updatedAt", {
        transaction,
      });
      console.log("Column updatedAt removed");
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
