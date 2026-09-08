import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Rename aisles to W00N format
 * Date: 2026-08-25
 *
 * Allée 1 -> W001, Allée 2 -> W002, ..., Allée 6 -> W006 (cohérent avec le
 * format des dataSource utilisés ailleurs dans l'application, ex: X001, F013).
 */

const RENAMES = [
  ["Allée 1", "W001"],
  ["Allée 2", "W002"],
  ["Allée 3", "W003"],
  ["Allée 4", "W004"],
  ["Allée 5", "W005"],
  ["Allée 6", "W006"],
];

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Rename aisles to W00N format...");

    for (const [oldName, newName] of RENAMES) {
      await queryInterface.bulkUpdate(
        "Aisles",
        { name: newName },
        { name: oldName },
        { transaction }
      );
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
    console.log("Rolling back: Restore 'Allée N' aisle names...");

    for (const [oldName, newName] of RENAMES) {
      await queryInterface.bulkUpdate(
        "Aisles",
        { name: oldName },
        { name: newName },
        { transaction }
      );
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
