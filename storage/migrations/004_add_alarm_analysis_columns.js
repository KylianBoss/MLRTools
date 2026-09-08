import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Add alarm analysis columns to Datalogs table
 * Date: 2026-02-10
 *
 * This migration adds the following columns to support daily alarm analysis:
 * - x_state: Classification of alarm (unplanned/planned)
 * - x_group: Grouping ID for related alarms
 * - x_treated: Whether alarm has been reviewed
 * - x_comment: Notes about the alarm
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add alarm analysis columns...");

    // Check if columns already exist
    const tableDescription = await queryInterface.describeTable("Datalogs");

    // Add x_state column if it doesn't exist
    if (!tableDescription.x_state) {
      console.log("Adding column: x_state");
      await queryInterface.addColumn(
        "Datalogs",
        "x_state",
        {
          type: Sequelize.ENUM("unplanned", "planned"),
          defaultValue: "unplanned",
          allowNull: false,
          comment: "State of alarm: unplanned (default) or planned maintenance",
        },
        { transaction }
      );
    } else {
      console.log("Column x_state already exists, skipping...");
    }

    // Add x_group column if it doesn't exist
    if (!tableDescription.x_group) {
      console.log("Adding column: x_group");
      await queryInterface.addColumn(
        "Datalogs",
        "x_group",
        {
          type: Sequelize.INTEGER,
          defaultValue: null,
          allowNull: true,
          comment: "Group ID for related alarms that should be counted as one",
        },
        { transaction }
      );
    } else {
      console.log("Column x_group already exists, skipping...");
    }

    // Add x_treated column if it doesn't exist
    if (!tableDescription.x_treated) {
      console.log("Adding column: x_treated");
      await queryInterface.addColumn(
        "Datalogs",
        "x_treated",
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: "Whether alarm has been reviewed/treated",
        },
        { transaction }
      );
    } else {
      console.log("Column x_treated already exists, skipping...");
    }

    // Add x_comment column if it doesn't exist
    if (!tableDescription.x_comment) {
      console.log("Adding column: x_comment");
      await queryInterface.addColumn(
        "Datalogs",
        "x_comment",
        {
          type: Sequelize.TEXT,
          defaultValue: null,
          allowNull: true,
          comment: "Comment/notes about the alarm",
        },
        { transaction }
      );
    } else {
      console.log("Column x_comment already exists, skipping...");
    }

    // Add indexes
    console.log("Adding indexes...");

    try {
      await queryInterface.addIndex("Datalogs", ["x_group"], {
        name: "idx_x_group",
        transaction,
      });
      console.log("Index idx_x_group created");
    } catch (error) {
      if (error.original?.errno === 1061) {
        // Duplicate key name
        console.log("Index idx_x_group already exists, skipping...");
      } else {
        throw error;
      }
    }

    try {
      await queryInterface.addIndex("Datalogs", ["x_state"], {
        name: "idx_x_state",
        transaction,
      });
      console.log("Index idx_x_state created");
    } catch (error) {
      if (error.original?.errno === 1061) {
        // Duplicate key name
        console.log("Index idx_x_state already exists, skipping...");
      } else {
        throw error;
      }
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
    console.log("Rolling back migration: Remove alarm analysis columns...");

    // Remove indexes
    console.log("Removing indexes...");

    try {
      await queryInterface.removeIndex("Datalogs", "idx_x_state", {
        transaction,
      });
      console.log("Index idx_x_state removed");
    } catch (error) {
      console.log("Index idx_x_state does not exist or already removed");
    }

    try {
      await queryInterface.removeIndex("Datalogs", "idx_x_group", {
        transaction,
      });
      console.log("Index idx_x_group removed");
    } catch (error) {
      console.log("Index idx_x_group does not exist or already removed");
    }

    // Remove columns
    console.log("Removing columns...");

    const tableDescription = await queryInterface.describeTable("Datalogs");

    if (tableDescription.x_comment) {
      await queryInterface.removeColumn("Datalogs", "x_comment", {
        transaction,
      });
      console.log("Column x_comment removed");
    }

    if (tableDescription.x_treated) {
      await queryInterface.removeColumn("Datalogs", "x_treated", {
        transaction,
      });
      console.log("Column x_treated removed");
    }

    if (tableDescription.x_group) {
      await queryInterface.removeColumn("Datalogs", "x_group", { transaction });
      console.log("Column x_group removed");
    }

    if (tableDescription.x_state) {
      await queryInterface.removeColumn("Datalogs", "x_state", { transaction });
      console.log("Column x_state removed");
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
