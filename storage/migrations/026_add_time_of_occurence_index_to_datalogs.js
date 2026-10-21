import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add index on Datalogs.timeOfOccurence
 * Date: 2026-10-21
 *
 * ExtractSAV.js passe de la lecture d'un CSV OneDrive à une requête directe
 * sur lnm.sav_export (MVN) et doit détecter les jours déjà présents dans
 * Datalogs pour ne récupérer que les jours manquants. Sans index, filtrer
 * par date scanne toute la table (4M+ lignes) à chaque exécution du cron.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add index on Datalogs.timeOfOccurence...");

    const indexes = await queryInterface.showIndex("Datalogs", { transaction });
    const exists = indexes.some((i) => i.name === "idx_time_of_occurence");

    if (!exists) {
      console.log("Adding index: idx_time_of_occurence");
      await queryInterface.addIndex("Datalogs", ["timeOfOccurence"], {
        name: "idx_time_of_occurence",
        transaction,
      });
    } else {
      console.log("Index idx_time_of_occurence already exists, skipping...");
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
    console.log("Rolling back: Remove index on Datalogs.timeOfOccurence...");

    const indexes = await queryInterface.showIndex("Datalogs", { transaction });
    const exists = indexes.some((i) => i.name === "idx_time_of_occurence");

    if (exists) {
      await queryInterface.removeIndex("Datalogs", "idx_time_of_occurence", {
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
