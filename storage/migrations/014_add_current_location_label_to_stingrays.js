import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add currentLocationLabel to Stingrays
 * Date: 2026-08-25
 *
 * Dénormalise le libellé de l'emplacement hors-allée courant (Maintenance
 * stingray, Stock, TGW...), pour l'affichage direct sans recalculer depuis
 * StingrayPositionHistories à chaque fois.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add currentLocationLabel to Stingrays...");

    await queryInterface.addColumn(
      "Stingrays",
      "currentLocationLabel",
      {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment:
          "Libellé de l'emplacement hors-allée courant, NULL si en allée",
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
    console.log("Rolling back: Remove currentLocationLabel from Stingrays...");
    await queryInterface.removeColumn("Stingrays", "currentLocationLabel", {
      transaction,
    });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
