import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add 'result' column to JobQueue
 * Date: 2026-09-14
 *
 * Permet à un job de la queue (traité par le PC BOT, seule instance connectée
 * au réseau MVN/Oracle) de transporter un résultat riche vers l'instance qui
 * l'a demandé, pas seulement un message d'erreur. Utilisé par l'action
 * 'executeMvnQuery' : la console DEV (CommandTool.vue) enfile un job SELECT
 * sur MVN, le bot l'exécute et écrit son résultat ici, la console le récupère
 * par polling. Voir src-electron/routes/Database.routes.js et
 * src-electron/routes/Cron.routes.js#executeJobAction.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const table = await queryInterface.describeTable("JobQueues");
  if (table.result) {
    console.log("Column 'result' already exists on JobQueues, skipping.");
    return;
  }

  await queryInterface.addColumn("JobQueues", "result", {
    type: Sequelize.JSON,
    allowNull: true,
    comment: "Résultat du job (ex: lignes retournées par une requête MVN)",
  });
  console.log("Migration completed: JobQueue.result added.");
}

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function down(queryInterface, Sequelize) {
  const table = await queryInterface.describeTable("JobQueues");
  if (!table.result) {
    console.log("Column 'result' does not exist on JobQueues, skipping.");
    return;
  }

  await queryInterface.removeColumn("JobQueues", "result");
  console.log("Rollback completed: JobQueues.result removed.");
}
