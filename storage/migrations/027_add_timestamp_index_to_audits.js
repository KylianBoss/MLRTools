import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add index on Audits.timestamp
 * Date: 2026-10-21
 *
 * CleanDB.js purge quotidiennement (cron "5 0 * * *") les entrées de plus de
 * 30 jours avec `DELETE WHERE timestamp < cutoffDate`. Sans index, cette
 * purge scanne toute la table (247k+ lignes, 170MB) chaque jour. RequestLogs
 * a déjà cet index pour exactement le même pattern de purge (voir
 * request_logs_timestamp) — Audits ne l'avait jamais eu.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add index on Audits.timestamp...");

    const indexes = await queryInterface.showIndex("Audits", { transaction });
    const exists = indexes.some((i) => i.name === "idx_audits_timestamp");

    if (!exists) {
      console.log("Adding index: idx_audits_timestamp");
      await queryInterface.addIndex("Audits", ["timestamp"], {
        name: "idx_audits_timestamp",
        transaction,
      });
    } else {
      console.log("Index idx_audits_timestamp already exists, skipping...");
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
    console.log("Rolling back: Remove index on Audits.timestamp...");

    const indexes = await queryInterface.showIndex("Audits", { transaction });
    const exists = indexes.some((i) => i.name === "idx_audits_timestamp");

    if (exists) {
      await queryInterface.removeIndex("Audits", "idx_audits_timestamp", {
        transaction,
      });
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
