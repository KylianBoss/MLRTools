import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add stingray link to Interventions
 * Date: 2026-08-20
 *
 * Permet de rattacher une intervention existante à un stingray de façon
 * structurée (colonne stingrayId, en plus du champ alarmCode en texte libre
 * déjà utilisé), et de tracer le changement d'état du stingray associé à
 * cette intervention (colonne newState). Dépend de la migration 011
 * (nécessite que la table Stingrays existe déjà).
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add stingray link to Interventions...");

    await queryInterface.addColumn(
      "Interventions",
      "stingrayId",
      {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Stingray concerné par cette intervention, si applicable",
        references: {
          model: "Stingrays",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      { transaction }
    );

    await queryInterface.addColumn(
      "Interventions",
      "newState",
      {
        type: Sequelize.ENUM(
          "in_service",
          "maintenance",
          "out_of_service",
          "spare"
        ),
        allowNull: true,
        comment:
          "Nouvel état du stingray suite à cette intervention, si applicable",
      },
      { transaction }
    );

    await queryInterface.addIndex("Interventions", ["stingrayId"], {
      name: "idx_intervention_stingray",
      transaction,
    });

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
    console.log("Rolling back: Remove stingray link from Interventions...");
    await queryInterface.removeIndex("Interventions", "idx_intervention_stingray", {
      transaction,
    });
    await queryInterface.removeColumn("Interventions", "newState", {
      transaction,
    });
    await queryInterface.removeColumn("Interventions", "stingrayId", {
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
