import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Create CaseCrashPhotos table
 * Date: 2026-10-07
 *
 * Stocke uniquement le nom de fichier des photos de chute de tours de
 * caisses envoyées par le flow Power Automate (en base64, décodées et
 * écrites sur disque côté machine bot dans storage/case-crashes/<crashId>/).
 * Le binaire ne transite jamais par cette table — seulement la référence.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Create CaseCrashPhotos table...");

    await queryInterface.createTable(
      "CaseCrashPhotos",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        caseCrashId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "CaseCrashes",
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        filename: {
          type: Sequelize.STRING,
          allowNull: false,
          comment:
            "Nom du fichier sur disque (storage/case-crashes/<caseCrashId>/<filename>), pas un chemin complet",
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction }
    );

    console.log("CaseCrashPhotos table created successfully");

    await queryInterface.addIndex("CaseCrashPhotos", ["caseCrashId"], {
      name: "idx_case_crash_photo_crash_id",
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
    console.log("Rolling back: Drop CaseCrashPhotos table...");
    await queryInterface.dropTable("CaseCrashPhotos", { transaction });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
