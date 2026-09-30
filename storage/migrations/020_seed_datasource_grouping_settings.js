import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Seed AUTO_GROUP_DATASOURCE_GAP_MS et
 * AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S
 * Date: 2026-09-29
 *
 * Ajoute les deux paramètres configurables utilisés par la dernière étape
 * du groupement automatique des alarmes (groupement temporel par
 * datasource, storage/services/autoGroupAlarms.js) :
 * - l'écart temporel maximal toléré entre deux alarmes pour les considérer
 *   comme faisant partie du même cluster,
 * - la durée maximale d'une alarme individuelle au-delà de laquelle elle
 *   est exclue de ce clustering (une alarme très longue, ex: non urgente
 *   car sans impact production, ne doit pas servir de pont et absorber
 *   des heures d'alarmes sans rapport dans un seul groupe).
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const settings = [
      {
        key: "AUTO_GROUP_DATASOURCE_GAP_MS",
        value: "300000",
        description:
          "Groupement automatique des alarmes (étape par datasource) : écart maximal en millisecondes entre deux alarmes pour qu'elles soient regroupées ensemble (défaut 300000 = 5 minutes)",
      },
      {
        key: "AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S",
        value: "600",
        description:
          "Groupement automatique des alarmes (étape par datasource) : durée maximale en secondes d'une alarme individuelle pour qu'elle participe au groupement ; au-delà, elle est exclue pour ne pas fusionner des heures d'alarmes sans rapport (défaut 600 = 10 minutes)",
      },
    ];

    for (const setting of settings) {
      console.log(`Seeding setting: ${setting.key}...`);

      const [existing] = await queryInterface.sequelize.query(
        "SELECT `key` FROM `Settings` WHERE `key` = ?",
        { replacements: [setting.key], transaction }
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert(
          "Settings",
          [{ ...setting, updatedAt: new Date() }],
          { transaction }
        );
        console.log(`Setting ${setting.key} created (${setting.value}).`);
      } else {
        console.log(`Setting ${setting.key} already exists, skipping.`);
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
    console.log(
      "Rolling back: Remove AUTO_GROUP_DATASOURCE_GAP_MS and AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S settings..."
    );
    await queryInterface.bulkDelete(
      "Settings",
      {
        key: [
          "AUTO_GROUP_DATASOURCE_GAP_MS",
          "AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S",
        ],
      },
      { transaction }
    );
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
