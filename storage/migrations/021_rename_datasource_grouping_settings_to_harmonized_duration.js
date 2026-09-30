import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Renomme AUTO_GROUP_DATASOURCE_GAP_MS et
 * AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S vers le système harmonisé de
 * settings "durée".
 * Date: 2026-09-29
 *
 * Le nouveau système (src-electron/services/settingsDuration.js) stocke les
 * durées en texte libre ("5 min", "10 min", "7 jours", ...) au lieu d'un
 * nombre brut dont l'unité était encodée dans le nom de la clé (suffixe
 * _MS/_S) ou sa description. Le nom de clé et la description ne portent
 * donc plus d'unité.
 *
 * Renomme :
 * - AUTO_GROUP_DATASOURCE_GAP_MS (300000)              -> AUTO_GROUP_DATASOURCE_GAP ("5 min")
 * - AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S (600)    -> AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION ("10 min")
 */

const RENAMES = [
  {
    oldKey: "AUTO_GROUP_DATASOURCE_GAP_MS",
    newKey: "AUTO_GROUP_DATASOURCE_GAP",
    newValue: "5 min",
    newDescription:
      "Groupement automatique des alarmes (étape par datasource) : écart maximal toléré entre deux alarmes pour qu'elles soient regroupées ensemble",
  },
  {
    oldKey: "AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION_S",
    newKey: "AUTO_GROUP_DATASOURCE_MAX_ALARM_DURATION",
    newValue: "10 min",
    newDescription:
      "Groupement automatique des alarmes (étape par datasource) : durée maximale d'une alarme individuelle pour qu'elle participe au groupement ; au-delà, elle est exclue pour ne pas fusionner des heures d'alarmes sans rapport",
  },
];

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const { oldKey, newKey, newValue, newDescription } of RENAMES) {
      const [existingOld] = await queryInterface.sequelize.query(
        "SELECT `key` FROM `Settings` WHERE `key` = ?",
        { replacements: [oldKey], transaction }
      );
      const [existingNew] = await queryInterface.sequelize.query(
        "SELECT `key` FROM `Settings` WHERE `key` = ?",
        { replacements: [newKey], transaction }
      );

      if (existingNew.length > 0) {
        console.log(`Setting ${newKey} already exists, skipping.`);
        continue;
      }

      if (existingOld.length > 0) {
        await queryInterface.bulkInsert(
          "Settings",
          [
            {
              key: newKey,
              value: newValue,
              description: newDescription,
              updatedAt: new Date(),
            },
          ],
          { transaction }
        );
        await queryInterface.bulkDelete("Settings", { key: oldKey }, { transaction });
        console.log(`Renamed ${oldKey} -> ${newKey} ("${newValue}").`);
      } else {
        // Ancienne clé absente (ex: migration 020 jamais appliquée sur cet
        // environnement) : créer directement la nouvelle.
        await queryInterface.bulkInsert(
          "Settings",
          [
            {
              key: newKey,
              value: newValue,
              description: newDescription,
              updatedAt: new Date(),
            },
          ],
          { transaction }
        );
        console.log(`Setting ${newKey} created directly ("${newValue}").`);
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
    for (const { oldKey, newKey } of RENAMES) {
      await queryInterface.bulkDelete("Settings", { key: newKey }, { transaction });
      console.log(`Removed ${newKey}. Note: original value of ${oldKey} is not restored.`);
    }
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
