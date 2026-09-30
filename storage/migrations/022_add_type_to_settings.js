import { Sequelize, QueryInterface } from "sequelize";

/**
 * Migration: Ajoute la colonne `type` à Settings + classifie toutes les
 * clés existantes + convertit les valeurs "duration" en texte lisible
 * Date: 2026-09-29
 *
 * Permet de marquer explicitement le type attendu d'une clé Settings :
 * - 'text'     : valeur libre quelconque (défaut)
 * - 'number'   : valeur numérique brute (compteur, seuil, montant...)
 * - 'date'     : date ISO (YYYY-MM-DD)
 * - 'duration' : texte de durée ("5 min", "10 sec", "7 jours"), validé et
 *                parsé par src-electron/services/settingsDuration.js
 * - 'secret'   : valeur sensible (token, clé API...), affichage masqué
 *                dans la page Settings admin
 * Sert à la fois à la validation de saisie côté page Settings admin et
 * côté API (PUT /settings/:key).
 *
 * Les clés "duration" voient aussi leur valeur convertie du nombre brut
 * (dont l'unité était seulement documentée dans la description) vers le
 * texte lisible correspondant — le nom de clé et la description ne portent
 * plus d'unité après cette migration. Tout call-site qui lisait ces clés
 * doit passer par getDurationSetting() (src-electron/services/
 * settingsDuration.js) ; ce n'est pas fait par cette migration.
 *
 * MIN_ALARM_DURATION reste volontairement en type 'text' avec sa valeur
 * numérique brute inchangée : elle est lue directement en SQL par 3
 * procédures stockées (getChartData, getKPICount,
 * getTop10AlarmsWithDailyBreakdown) via
 * `SELECT s.value INTO <INT> FROM Settings WHERE key = 'MIN_ALARM_DURATION'`
 * — un cast implicite VARCHAR->INT qui échouerait sous sql_mode
 * STRICT_TRANS_TABLES (actif sur au moins une session de cette DB) si la
 * valeur devenait un texte du type "30 sec". Ces procédures doivent être
 * mises à jour pour parser explicitement AVANT de migrer cette clé.
 */

const DURATION_VALUES = {
  // key -> [nombre brut actuel, texte lisible]
  CASE_CRASHES_REPORT_DAYS: ["30", "30 jours"],
  GRAPH_TABLE_WINDOW: ["7", "7 jours"],
  GRAPH_WINDOW: ["250", "250 jours"],
  MOVING_AVERAGE_WINDOW: ["7", "7 jours"],
  STINGRAY_ALARM_WINDOW_DAYS: ["30", "30 jours"],
  // Valeur d'origine incohérente avec sa description ("jours") mais
  // conservée telle quelle à la demande explicite (pas de correction
  // silencieuse d'une valeur en prod sans confirmation).
  CUSTOM_CHART_WINDOW: ["365000", "365000 jours"],
};

const NUMBER_KEYS = [
  "CHART_X_TICK_AMOUNT",
  "MIN_PROD_TO_TAKE",
  "STINGRAY_ALARM_CRITICAL_THRESHOLD",
  "STINGRAY_ALARM_WARN_THRESHOLD",
];

const DATE_KEYS = ["dailyAnalysisDoneDate", "MIN_DATE"];

const SECRET_KEYS = ["cloudflareTunnelToken", "botApiKey", "APP_2FA_SECRET"];

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const tableDescription = await queryInterface.describeTable("Settings");

    if (!tableDescription.type) {
      console.log("Adding column: Settings.type");
      await queryInterface.addColumn(
        "Settings",
        "type",
        {
          type: Sequelize.ENUM("text", "number", "date", "duration", "secret"),
          allowNull: false,
          defaultValue: "text",
          comment:
            "'text' = valeur libre, 'number' = valeur numérique, 'date' = date ISO, 'duration' = valeur textuelle de durée (ex: '5 min', '10 sec', '7 jours') validée par settingsDuration.js, 'secret' = valeur sensible affichée masquée",
        },
        { transaction }
      );
    } else {
      console.log("Column Settings.type already exists, skipping...");
    }

    console.log("Marking number settings...");
    await queryInterface.bulkUpdate(
      "Settings",
      { type: "number" },
      { key: NUMBER_KEYS },
      { transaction }
    );

    console.log("Marking date settings...");
    await queryInterface.bulkUpdate("Settings", { type: "date" }, { key: DATE_KEYS }, { transaction });

    console.log("Marking secret settings...");
    await queryInterface.bulkUpdate(
      "Settings",
      { type: "secret" },
      { key: SECRET_KEYS },
      { transaction }
    );

    console.log("Marking duration settings and converting their value to readable text...");
    for (const [key, [expectedRawValue, newValue]] of Object.entries(DURATION_VALUES)) {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT `value` FROM `Settings` WHERE `key` = ?",
        { replacements: [key], transaction }
      );
      if (rows.length === 0) {
        console.log(`  ${key}: not found, skipping.`);
        continue;
      }

      const currentValue = rows[0].value;
      if (currentValue !== expectedRawValue) {
        console.log(
          `  ${key}: current value "${currentValue}" differs from expected "${expectedRawValue}" — converting anyway to "${newValue}".`
        );
      }

      await queryInterface.bulkUpdate(
        "Settings",
        { type: "duration", value: newValue },
        { key },
        { transaction }
      );
      console.log(`  ${key}: "${currentValue}" -> "${newValue}"`);
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
    console.log("Restoring raw numeric values for duration settings...");
    for (const [key, [rawValue]] of Object.entries(DURATION_VALUES)) {
      await queryInterface.bulkUpdate("Settings", { value: rawValue }, { key }, { transaction });
    }

    const tableDescription = await queryInterface.describeTable("Settings");
    if (tableDescription.type) {
      console.log("Removing column: Settings.type");
      await queryInterface.removeColumn("Settings", "type", { transaction });
    }
    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  }
}
