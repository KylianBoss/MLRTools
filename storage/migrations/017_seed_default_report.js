import { Sequelize, QueryInterface } from "sequelize";
import mariadb from "mariadb";

/**
 * Migration: Seed default "Rapport quotidien" report
 * Date: 2026-09-08
 *
 * Crée un rapport par défaut reprenant exactement l'ordre des sections
 * actuellement codées en dur dans generateKPIPDF() : chutes de tours de
 * caisses, moyenne 7 jours, un bloc par ZoneGroup affiché (dans son ordre
 * actuel), un bloc par CustomChart visible, puis interventions
 * planifiées/non-planifiées.
 *
 * IMPORTANT : cette migration ne crée AUCUN abonnement dans UserReports.
 * Décision utilisateur explicite : les destinataires du rapport quotidien
 * seront reconfigurés manuellement depuis l'UI (UsersSettings.vue) une fois
 * le système livré, plutôt que d'être migrés automatiquement depuis l'ancien
 * champ Users.recieveDailyReport. Conséquence : aucun email KPI ne sera
 * envoyé tant que les abonnements n'auront pas été reconfigurés manuellement.
 *
 * Noms de table vérifiés (voir plan) : `CustomCharts` (confirmé via
 * storage/migrations/015_add_visible_to_custom_charts.sql) et `ZoneGroups`
 * (modèle déjà nommé au pluriel, pas de transformation Sequelize).
 *
 * Note technique : sur cette stack (sequelize@6.37.5 + mariadb@3.4.0),
 * `sequelize.query()` sur un SELECT lève "Cannot delete property 'meta' of
 * [object Array]" (incompatibilité connue entre ces deux versions sur le
 * formatage des résultats). `queryInterface.bulkInsert`/`bulkDelete`
 * fonctionnent normalement (chemin de code différent). Cette migration
 * utilise donc une connexion `mariadb` séparée en lecture seule pour tous
 * les SELECT, et `queryInterface` (dans la transaction Sequelize) pour les
 * écritures — évite le bug sans changer le comportement de la migration.
 */

const DEFAULT_REPORT_SLUG = "rapport-quotidien";

async function openReadConnection(sequelize) {
  const options = sequelize.options;
  return mariadb.createConnection({
    host: options.host,
    port: options.port,
    user: sequelize.config.username,
    password: sequelize.config.password,
    database: sequelize.config.database,
  });
}

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const sequelize = queryInterface.sequelize;
  const transaction = await sequelize.transaction();
  const readConn = await openReadConnection(sequelize);

  try {
    console.log("Starting migration: Seed default report...");

    const existing = await readConn.query(
      "SELECT `id` FROM `Reports` WHERE `slug` = ?",
      [DEFAULT_REPORT_SLUG]
    );

    if (existing.length > 0) {
      console.log(
        `Default report "${DEFAULT_REPORT_SLUG}" already exists (id=${existing[0].id}), skipping seed.`
      );
      await transaction.commit();
      return;
    }

    console.log("Creating default report...");
    await queryInterface.bulkInsert(
      "Reports",
      [
        {
          name: "Rapport quotidien",
          slug: DEFAULT_REPORT_SLUG,
          description:
            "Rapport historique migré automatiquement, reprend l'ordre des sections précédemment codées en dur.",
          active: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      { transaction }
    );

    // La lecture se fait hors transaction (connexion séparée) : le SELECT
    // qui suit doit voir la ligne tout juste insérée. On commit d'abord
    // l'insertion du rapport seule, puis on ouvre une nouvelle transaction
    // pour les ReportBlocks — reste idempotent grâce au check du slug ci-dessus.
    await transaction.commit();

    const [report] = await readConn.query(
      "SELECT `id` FROM `Reports` WHERE `slug` = ?",
      [DEFAULT_REPORT_SLUG]
    );
    const reportId = report.id;
    console.log(`Default report created with id=${reportId}`);

    const blocksTransaction = await sequelize.transaction();
    try {
      const blocks = [];
      let order = 0;

      blocks.push({ reportId, blockType: "caseCrashes", refId: null, order: order++ });
      blocks.push({ reportId, blockType: "sevenDaysAverage", refId: null, order: order++ });

      console.log("Fetching displayed zone groups...");
      const zoneGroups = await readConn.query(
        "SELECT `zoneGroupName` FROM `ZoneGroups` WHERE `display` = 1 ORDER BY `order` ASC"
      );
      for (const group of zoneGroups) {
        blocks.push({
          reportId,
          blockType: "zoneGroup",
          refId: group.zoneGroupName,
          order: order++,
        });
      }
      console.log(`Added ${zoneGroups.length} zoneGroup block(s).`);

      console.log("Fetching visible custom charts...");
      const customCharts = await readConn.query(
        "SELECT `id` FROM `CustomCharts` WHERE `visible` = 1 ORDER BY `id` ASC"
      );
      for (const chart of customCharts) {
        blocks.push({
          reportId,
          blockType: "customChart",
          refId: String(chart.id),
          order: order++,
        });
      }
      console.log(`Added ${customCharts.length} customChart block(s).`);

      blocks.push({
        reportId,
        blockType: "plannedInterventions",
        refId: null,
        order: order++,
      });
      blocks.push({
        reportId,
        blockType: "unplannedInterventions",
        refId: null,
        order: order++,
      });

      await queryInterface.bulkInsert("ReportBlocks", blocks, {
        transaction: blocksTransaction,
      });
      console.log(`Inserted ${blocks.length} report block(s) total.`);

      console.log(
        "No UserReports subscriptions created — recipients must be configured manually after deploy."
      );

      await blocksTransaction.commit();
      console.log("Migration completed successfully!");
    } catch (blocksError) {
      await blocksTransaction.rollback();
      // Le rapport a déjà été commité — le supprimer pour rester atomique
      // du point de vue de l'utilisateur (pas de rapport sans blocs).
      try {
        await queryInterface.bulkDelete("Reports", { id: reportId });
      } catch (cleanupError) {
        // Si CE nettoyage échoue aussi, le Report orphelin (sans bloc) reste
        // en base — et comme le check d'idempotence en haut de up() ne
        // regarde que l'existence du slug, une relance ultérieure skipperait
        // silencieusement sans jamais compléter le seed. Log explicite pour
        // qu'un opérateur voie le problème au lieu de le découvrir plus tard.
        console.error(
          `CRITIQUE: le rapport orphelin id=${reportId} (créé mais sans blocs) n'a pas pu être nettoyé : ${cleanupError.message}. Vérifier/supprimer manuellement cette ligne dans Reports avant de relancer la migration.`
        );
      }
      throw blocksError;
    }
  } catch (error) {
    // La transaction principale ne couvre que l'insertion du rapport ;
    // si elle a déjà été commitée, ce rollback est un no-op silencieux.
    try {
      await transaction.rollback();
    } catch (_) {
      // déjà commitée, rien à faire
    }
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await readConn.end();
  }
}

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function down(queryInterface, Sequelize) {
  const sequelize = queryInterface.sequelize;
  const transaction = await sequelize.transaction();
  const readConn = await openReadConnection(sequelize);

  try {
    console.log("Rolling back: Remove default report seed...");

    const existing = await readConn.query(
      "SELECT `id` FROM `Reports` WHERE `slug` = ?",
      [DEFAULT_REPORT_SLUG]
    );

    if (existing.length > 0) {
      const reportId = existing[0].id;
      // ReportBlocks et UserReports sont supprimés en CASCADE via la FK reportId
      await queryInterface.bulkDelete("Reports", { id: reportId }, { transaction });
      console.log(`Default report (id=${reportId}) removed.`);
    } else {
      console.log("Default report not found, nothing to roll back.");
    }

    await transaction.commit();
    console.log("Rollback completed successfully!");
  } catch (error) {
    await transaction.rollback();
    console.error("Rollback failed:", error);
    throw error;
  } finally {
    await readConn.end();
  }
}
