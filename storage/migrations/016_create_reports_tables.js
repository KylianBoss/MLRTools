import { Sequelize, DataTypes, QueryInterface } from "sequelize";

/**
 * Migration: Create Reports, ReportBlocks and UserReports tables
 * Date: 2026-09-08
 *
 * Système de rapports KPI configurables : un rapport (Reports) est défini par
 * une liste ordonnée de blocs de contenu (ReportBlocks), chaque bloc référençant
 * soit un contenu statique (chutes de caisses, moyenne 7 jours, interventions
 * planifiées/non-planifiées), soit un ZoneGroup/CustomChart existant via refId.
 * Un utilisateur peut être abonné à plusieurs rapports (UserReports, many-to-many).
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Create Reports tables...");

    // showAllTables() renvoie soit des strings, soit des objets
    // {tableName, schema} selon le dialecte/version — normaliser les deux.
    const rawTables = await queryInterface.showAllTables();
    const tables = rawTables.map((t) => (typeof t === "string" ? t : t.tableName));

    if (!tables.includes("Reports")) {
      await queryInterface.createTable(
        "Reports",
        {
          id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: Sequelize.STRING(100),
            allowNull: false,
            comment: "Nom affiché du rapport, ex: Rapport Essentiel",
          },
          slug: {
            type: Sequelize.STRING(50),
            allowNull: false,
            unique: true,
            comment: "Dérivé du nom (kebab-case), utilisé dans le nom du fichier PDF",
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: "Si false, jamais généré ni envoyé par le cron sendKPI",
          },
          createdBy: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: true,
            comment: "ID de l'utilisateur qui a créé le rapport",
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
      console.log("Reports table created successfully");
    } else {
      console.log("Reports table already exists, skipping...");
    }

    if (!tables.includes("ReportBlocks")) {
      await queryInterface.createTable(
        "ReportBlocks",
        {
          id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
          },
          reportId: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            references: {
              model: "Reports",
              key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
          blockType: {
            type: Sequelize.ENUM(
              "caseCrashes",
              "sevenDaysAverage",
              "zoneGroup",
              "customChart",
              "plannedInterventions",
              "unplannedInterventions"
            ),
            allowNull: false,
          },
          refId: {
            type: Sequelize.STRING(50),
            allowNull: true,
            comment:
              "zoneGroupName ou CustomChart.id stringifié ; NULL pour les blocs statiques",
          },
          order: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            comment: "Ordre du bloc dans le rapport, utilisé pour le tri",
          },
          config: {
            type: Sequelize.JSON,
            allowNull: true,
            comment: "Réservé pour des paramètres futurs par bloc, non utilisé au lancement",
          },
        },
        { transaction }
      );
      console.log("ReportBlocks table created successfully");
    } else {
      console.log("ReportBlocks table already exists, skipping...");
    }

    if (!tables.includes("UserReports")) {
      await queryInterface.createTable(
        "UserReports",
        {
          id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
          },
          userId: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
          },
          reportId: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            references: {
              model: "Reports",
              key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
        },
        { transaction }
      );
      console.log("UserReports table created successfully");
    } else {
      console.log("UserReports table already exists, skipping...");
    }

    console.log("Adding indexes...");

    const reportBlocksIndexes = await queryInterface.showIndex("ReportBlocks", {
      transaction,
    });
    if (!reportBlocksIndexes.some((i) => i.name === "idx_reportblocks_report_order")) {
      await queryInterface.addIndex("ReportBlocks", ["reportId", "order"], {
        name: "idx_reportblocks_report_order",
        transaction,
      });
    }

    const userReportsIndexes = await queryInterface.showIndex("UserReports", {
      transaction,
    });
    if (!userReportsIndexes.some((i) => i.name === "idx_userreports_user_report")) {
      await queryInterface.addIndex("UserReports", ["userId", "reportId"], {
        name: "idx_userreports_user_report",
        unique: true,
        transaction,
      });
    }

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
    console.log("Rolling back: Drop UserReports, ReportBlocks and Reports tables...");
    await queryInterface.dropTable("UserReports", { transaction });
    await queryInterface.dropTable("ReportBlocks", { transaction });
    await queryInterface.dropTable("Reports", { transaction });
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
