import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Create CaseCrashes and CaseCrashTypes tables
 * Date: 2026-07-22
 *
 * Ces tables permettent d'enregistrer manuellement les chutes de tours de
 * caisses (date, zone) ainsi que les types de caisses présents dans la tour
 * au moment de la chute (relation many-to-many).
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Create CaseCrashes table...");

    await queryInterface.createTable(
      "CaseCrashes",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        crashDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          comment: "Date de la chute de la tour de caisses",
        },
        zone: {
          type: Sequelize.ENUM(
            "F013",
            "X001",
            "X002",
            "X003",
            "X101",
            "X102",
            "X103",
            "X104"
          ),
          allowNull: false,
          comment: "Zone où la chute a eu lieu",
        },
        createdBy: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          comment: "Utilisateur qui a créé l'entrée",
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
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

    console.log("CaseCrashes table created successfully");

    await queryInterface.createTable(
      "CaseCrashTypes",
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
        caseType: {
          type: Sequelize.ENUM("A", "B", "C", "E", "H", "U"),
          allowNull: false,
          comment: "Type de caisse présent dans la tour",
        },
      },
      { transaction }
    );

    console.log("CaseCrashTypes table created successfully");

    console.log("Adding indexes...");

    await queryInterface.addIndex("CaseCrashes", ["crashDate"], {
      name: "idx_case_crash_date",
      transaction,
    });

    await queryInterface.addIndex("CaseCrashes", ["zone"], {
      name: "idx_case_crash_zone",
      transaction,
    });

    await queryInterface.addIndex(
      "CaseCrashTypes",
      ["caseCrashId", "caseType"],
      {
        name: "idx_case_crash_type_unique",
        unique: true,
        transaction,
      }
    );

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
    console.log("Rolling back: Drop CaseCrashTypes and CaseCrashes tables...");
    await queryInterface.dropTable("CaseCrashTypes", { transaction });
    await queryInterface.dropTable("CaseCrashes", { transaction });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
