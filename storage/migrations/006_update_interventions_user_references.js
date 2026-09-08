import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Update Interventions table to use user IDs instead of usernames
 * Date: 2026-02-12
 *
 * This migration:
 * - Renames createdBy to createdByUserId (INTEGER FK)
 * - Renames validatedBy to validatedByUserId (INTEGER FK)
 * - Adds foreign key constraints to Users table
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Update Interventions user references...");

    // Step 1: Add new columns
    console.log("Adding createdByUserId column...");
    await queryInterface.addColumn(
      "Interventions",
      "createdByUserId",
      {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "User ID who created the intervention",
      },
      { transaction }
    );

    console.log("Adding validatedByUserId column...");
    await queryInterface.addColumn(
      "Interventions",
      "validatedByUserId",
      {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "User ID who validated the intervention",
      },
      { transaction }
    );

    // Step 2: Migrate data from username to userId
    console.log("Migrating existing data...");
    await queryInterface.sequelize.query(
      `
      UPDATE Interventions i
      INNER JOIN Users u ON i.createdBy = u.username
      SET i.createdByUserId = u.id
      WHERE i.createdBy IS NOT NULL
      `,
      { transaction }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE Interventions i
      INNER JOIN Users u ON i.validatedBy = u.username
      SET i.validatedByUserId = u.id
      WHERE i.validatedBy IS NOT NULL
      `,
      { transaction }
    );

    // Step 3: Remove old columns
    console.log("Removing old createdBy column...");
    await queryInterface.removeColumn("Interventions", "createdBy", {
      transaction,
    });

    console.log("Removing old validatedBy column...");
    await queryInterface.removeColumn("Interventions", "validatedBy", {
      transaction,
    });

    // Step 4: Rename new columns to final names
    console.log("Renaming createdByUserId to createdBy...");
    await queryInterface.renameColumn(
      "Interventions",
      "createdByUserId",
      "createdBy",
      { transaction }
    );

    console.log("Renaming validatedByUserId to validatedBy...");
    await queryInterface.renameColumn(
      "Interventions",
      "validatedByUserId",
      "validatedBy",
      { transaction }
    );

    // Step 5: Make createdBy NOT NULL
    console.log("Making createdBy NOT NULL...");
    await queryInterface.changeColumn(
      "Interventions",
      "createdBy",
      {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "User ID who created the intervention",
      },
      { transaction }
    );

    // Step 6: Add foreign key constraints
    console.log("Adding foreign key constraint for createdBy...");
    await queryInterface.addConstraint("Interventions", {
      fields: ["createdBy"],
      type: "foreign key",
      name: "fk_interventions_created_by",
      references: {
        table: "Users",
        field: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      transaction,
    });

    console.log("Adding foreign key constraint for validatedBy...");
    await queryInterface.addConstraint("Interventions", {
      fields: ["validatedBy"],
      type: "foreign key",
      name: "fk_interventions_validated_by",
      references: {
        table: "Users",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      transaction,
    });

    // Step 7: Create new index on createdBy (index was auto-dropped when column was dropped)
    console.log("Creating new index on createdBy...");
    await queryInterface.addIndex("Interventions", ["createdBy"], {
      name: "idx_created_by",
      transaction,
    });

    console.log("Migration completed successfully!");
    await transaction.commit();
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
    console.log("Rolling back: Restore username columns...");

    // Remove foreign key constraints
    await queryInterface.removeConstraint(
      "Interventions",
      "fk_interventions_created_by",
      { transaction }
    );
    await queryInterface.removeConstraint(
      "Interventions",
      "fk_interventions_validated_by",
      { transaction }
    );

    // Add temporary columns for usernames
    await queryInterface.addColumn(
      "Interventions",
      "createdByUsername",
      {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.addColumn(
      "Interventions",
      "validatedByUsername",
      {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      { transaction }
    );

    // Migrate data back
    await queryInterface.sequelize.query(
      `
      UPDATE Interventions i
      INNER JOIN Users u ON i.createdBy = u.id
      SET i.createdByUsername = u.username
      WHERE i.createdBy IS NOT NULL
      `,
      { transaction }
    );

    await queryInterface.sequelize.query(
      `
      UPDATE Interventions i
      INNER JOIN Users u ON i.validatedBy = u.id
      SET i.validatedByUsername = u.username
      WHERE i.validatedBy IS NOT NULL
      `,
      { transaction }
    );

    // Remove ID columns
    await queryInterface.removeColumn("Interventions", "createdBy", {
      transaction,
    });
    await queryInterface.removeColumn("Interventions", "validatedBy", {
      transaction,
    });

    // Rename back
    await queryInterface.renameColumn(
      "Interventions",
      "createdByUsername",
      "createdBy",
      { transaction }
    );
    await queryInterface.renameColumn(
      "Interventions",
      "validatedByUsername",
      "validatedBy",
      { transaction }
    );

    // Make createdBy NOT NULL
    await queryInterface.changeColumn(
      "Interventions",
      "createdBy",
      {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      { transaction }
    );

    // Recreate index
    await queryInterface.addIndex("Interventions", ["createdBy"], {
      name: "idx_created_by",
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
