import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Add 'trigger' action + triggerAlarmId + windowAfterMs to AutoGroupRules
 * Date: 2026-09-10
 *
 * Ajoute une nouvelle action de règle "trigger" : une alarme déclencheuse
 * identifiée par son alarmId exact (ex: interrupteur à clé d'une porte,
 * peu importe son type/classification dans la table Alarms) capture toutes
 * les alarmes d'une zone (liste de paires précises {dataSource, alarmArea})
 * sur toute la durée de l'incident (avant et après son occurrence), plus une
 * marge après sa clôture (windowAfterMs, défaut 2 minutes).
 *
 * keyword devient nullable car les règles "trigger" identifient leur
 * déclencheur via triggerAlarmId plutôt qu'un mot-clé/regex.
 */

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Add trigger action to AutoGroupRules...");

    const tableDescription = await queryInterface.describeTable("AutoGroupRules");

    if (!tableDescription.windowAfterMs) {
      console.log("Adding column: windowAfterMs");
      await queryInterface.addColumn(
        "AutoGroupRules",
        "windowAfterMs",
        {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          defaultValue: 120000,
          comment:
            "Marge en ms après la clôture (timeOfAcknowledge, sinon timeOfOccurence) de l'alarme déclencheuse pendant laquelle les alarmes de 'zone' sont capturées (utilisé si action = trigger). Défaut 2 minutes.",
        },
        { transaction }
      );
    } else {
      console.log("Column windowAfterMs already exists, skipping...");
    }

    if (!tableDescription.triggerAlarmId) {
      console.log("Adding column: triggerAlarmId");
      await queryInterface.addColumn(
        "AutoGroupRules",
        "triggerAlarmId",
        {
          type: Sequelize.STRING,
          allowNull: true,
          comment:
            "alarmId exact et unique (table Alarms) de l'alarme déclencheuse, peu importe son type ('human' inclus). Utilisé uniquement si action = trigger — pas de mot-clé/regex ici pour éviter toute ambiguïté sur le déclencheur.",
        },
        { transaction }
      );
    } else {
      console.log("Column triggerAlarmId already exists, skipping...");
    }

    console.log("Extending ENUM action with 'trigger'...");
    await queryInterface.changeColumn(
      "AutoGroupRules",
      "action",
      {
        type: Sequelize.ENUM("group", "treat", "trigger"),
        allowNull: false,
        defaultValue: "group",
        comment:
          "'group' = grouper les alarmes, 'treat' = marquer comme traitées sans grouper, 'trigger' = capturer toutes les alarmes d'une zone pendant qu'une alarme déclencheuse est active + une marge",
      },
      { transaction }
    );

    console.log("Making keyword nullable (unused for action = trigger)...");
    await queryInterface.changeColumn(
      "AutoGroupRules",
      "keyword",
      {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Mot-clé à chercher dans alarmText (insensible à la casse). Non utilisé si action = trigger",
      },
      { transaction }
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `AutoGroupRules` MODIFY COLUMN `zone` JSON NULL COMMENT 'Si groupBy = zone: array de dataSources (string[]). Si action = trigger: array de paires precises {dataSource, alarmArea}.'",
      { transaction }
    );

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
    console.log("Rolling back migration: Remove trigger action from AutoGroupRules...");

    // Repasse toute règle "trigger" en "group" avant de retirer la valeur de l'ENUM
    await queryInterface.sequelize.query(
      "UPDATE `AutoGroupRules` SET `action` = 'group', `keyword` = COALESCE(`keyword`, '') WHERE `action` = 'trigger'",
      { transaction }
    );

    await queryInterface.changeColumn(
      "AutoGroupRules",
      "action",
      {
        type: Sequelize.ENUM("group", "treat"),
        allowNull: false,
        defaultValue: "group",
        comment: "'group' = grouper les alarmes, 'treat' = marquer comme traitées sans grouper",
      },
      { transaction }
    );

    await queryInterface.changeColumn(
      "AutoGroupRules",
      "keyword",
      {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Mot-clé à chercher dans alarmText (insensible à la casse)",
      },
      { transaction }
    );

    const tableDescription = await queryInterface.describeTable("AutoGroupRules");
    if (tableDescription.windowAfterMs) {
      await queryInterface.removeColumn("AutoGroupRules", "windowAfterMs", { transaction });
      console.log("Column windowAfterMs removed");
    }
    if (tableDescription.triggerAlarmId) {
      await queryInterface.removeColumn("AutoGroupRules", "triggerAlarmId", { transaction });
      console.log("Column triggerAlarmId removed");
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
