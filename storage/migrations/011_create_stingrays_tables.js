import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Create Aisles, Stingrays and StingrayPositionHistories tables
 * Date: 2026-08-20
 *
 * Référentiel des stingrays (parc de 178 unités), des 6 allées du shuttle
 * (28 étages chacune), et historique append-only des positions. Seed des
 * 6 allées et des seuils d'alarme configurables (table Settings).
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Create Stingrays tables...");

    await queryInterface.createTable(
      "Aisles",
      {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: "Nom de l'allée, ex: Allée 1",
        },
        floorsCount: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 28,
          comment: "Nombre d'étages de l'allée",
        },
      },
      { transaction }
    );

    console.log("Aisles table created successfully");

    await queryInterface.createTable(
      "Stingrays",
      {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        number: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          comment:
            "Numéro physique du stingray, correspond au Shuttle N du Datalog",
        },
        serialNumber: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        state: {
          type: Sequelize.ENUM(
            "in_service",
            "maintenance",
            "out_of_service",
            "spare"
          ),
          allowNull: false,
          defaultValue: "spare",
          comment: "État courant du stingray",
        },
        currentAisleId: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "Aisles",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          comment:
            "Dénormalisé depuis la dernière position en allée, NULL si pas en allée",
        },
        currentFloor: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          comment: "Étage courant (1-28), dénormalisé, NULL si pas en allée",
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
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

    console.log("Stingrays table created successfully");

    await queryInterface.createTable(
      "StingrayPositionHistories",
      {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        stingrayId: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: "Stingrays",
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        aisleId: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "Aisles",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          comment: "NULL = atelier/stock/hors service",
        },
        floor: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          comment: "Étage (1-28), NULL si aisleId est NULL",
        },
        locationLabel: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: "Libellé libre pour les positions hors-allée, ex: Atelier",
        },
        movedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          comment: "Date d'entrée à cette position",
        },
        movedBy: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "Users",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        comment: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction }
    );

    console.log("StingrayPositionHistories table created successfully");

    console.log("Adding indexes...");

    await queryInterface.addIndex("Aisles", ["name"], {
      name: "idx_aisle_name",
      unique: true,
      transaction,
    });

    await queryInterface.addIndex("Stingrays", ["number"], {
      name: "idx_stingray_number",
      unique: true,
      transaction,
    });

    await queryInterface.addIndex("Stingrays", ["state"], {
      name: "idx_stingray_state",
      transaction,
    });

    await queryInterface.addIndex(
      "StingrayPositionHistories",
      ["stingrayId", "movedAt"],
      {
        name: "idx_position_stingray_moved",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "StingrayPositionHistories",
      ["aisleId", "floor"],
      {
        name: "idx_position_aisle_floor",
        transaction,
      }
    );

    console.log("Indexes created successfully");

    console.log("Seeding the 6 aisles...");
    await queryInterface.bulkInsert(
      "Aisles",
      [1, 2, 3, 4, 5, 6].map((n) => ({
        name: `Allée ${n}`,
        floorsCount: 28,
      })),
      { transaction }
    );

    console.log("Seeding stingray alarm settings...");
    const [existingSettings] = await queryInterface.sequelize.query(
      "SELECT `key` FROM `Settings` WHERE `key` IN ('STINGRAY_ALARM_WINDOW_DAYS', 'STINGRAY_ALARM_WARN_THRESHOLD', 'STINGRAY_ALARM_CRITICAL_THRESHOLD')",
      { transaction }
    );
    const existingKeys = new Set(existingSettings.map((s) => s.key));
    const settingsToInsert = [
      {
        key: "STINGRAY_ALARM_WINDOW_DAYS",
        value: "30",
        description:
          "Fenêtre glissante (jours) pour le calcul du niveau d'alarme des stingrays",
      },
      {
        key: "STINGRAY_ALARM_WARN_THRESHOLD",
        value: "5",
        description:
          "Score d'alarme à partir duquel un stingray passe en niveau attention",
      },
      {
        key: "STINGRAY_ALARM_CRITICAL_THRESHOLD",
        value: "15",
        description:
          "Score d'alarme à partir duquel un stingray passe en niveau critique",
      },
    ]
      .filter((s) => !existingKeys.has(s.key))
      .map((s) => ({ ...s, updatedAt: new Date() }));

    if (settingsToInsert.length > 0) {
      await queryInterface.bulkInsert("Settings", settingsToInsert, {
        transaction,
      });
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
    console.log(
      "Rolling back: Drop StingrayPositionHistories, Stingrays and Aisles tables..."
    );
    await queryInterface.bulkDelete(
      "Settings",
      {
        key: [
          "STINGRAY_ALARM_WINDOW_DAYS",
          "STINGRAY_ALARM_WARN_THRESHOLD",
          "STINGRAY_ALARM_CRITICAL_THRESHOLD",
        ],
      },
      { transaction }
    );
    await queryInterface.dropTable("StingrayPositionHistories", {
      transaction,
    });
    await queryInterface.dropTable("Stingrays", { transaction });
    await queryInterface.dropTable("Aisles", { transaction });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
