import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Create Interventions table
 * Date: 2026-02-12
 *
 * This migration creates the Interventions table to track all interventions
 * (both planned maintenance and unplanned incidents) that occur in the facility.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Create Interventions table...");

    await queryInterface.createTable(
      "Interventions",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        plannedDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          comment: "Date de l'intervention",
        },
        alarmCode: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: "Code de l'alarme (X003, Shuttle 67, etc.)",
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: "Description de l'intervention",
        },
        startTime: {
          type: Sequelize.TIME,
          allowNull: true,
          comment: "Heure de début",
        },
        endTime: {
          type: Sequelize.TIME,
          allowNull: true,
          comment: "Heure de fin",
        },
        comment: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: "Commentaire sur l'intervention",
        },
        isPlanned: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          comment:
            "true = intervention planifiée (maintenance), false = non planifiée (panne)",
        },
        createdBy: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "Utilisateur qui a créé l'entrée",
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        status: {
          type: Sequelize.ENUM("pending", "validated", "ignored"),
          defaultValue: "pending",
          comment: "Statut de l'intervention",
        },
        validatedAt: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "Date de validation",
        },
        validatedBy: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: "Utilisateur qui a validé",
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
          ),
        },
      },
      { transaction }
    );

    console.log("Interventions table created successfully");

    // Index pour améliorer les performances
    console.log("Adding indexes...");

    await queryInterface.addIndex("Interventions", ["plannedDate"], {
      name: "idx_planned_date",
      transaction,
    });

    await queryInterface.addIndex("Interventions", ["status"], {
      name: "idx_status",
      transaction,
    });

    await queryInterface.addIndex("Interventions", ["createdBy"], {
      name: "idx_created_by",
      transaction,
    });

    console.log("Indexes created successfully");

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
    console.log("Rolling back: Drop Interventions table...");
    await queryInterface.dropTable("Interventions", { transaction });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
