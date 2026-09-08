import { Sequelize, QueryInterface } from "sequelize";

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
 */

const DEFAULT_REPORT_SLUG = "rapport-quotidien";

/**
 * @param {QueryInterface} queryInterface
 * @param {Sequelize} Sequelize
 */
export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log("Starting migration: Seed default report...");

    const [existing] = await queryInterface.sequelize.query(
      "SELECT `id` FROM `Reports` WHERE `slug` = :slug",
      {
        replacements: { slug: DEFAULT_REPORT_SLUG },
        transaction,
      }
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

    const [[report]] = await queryInterface.sequelize.query(
      "SELECT `id` FROM `Reports` WHERE `slug` = :slug",
      {
        replacements: { slug: DEFAULT_REPORT_SLUG },
        transaction,
      }
    );
    const reportId = report.id;
    console.log(`Default report created with id=${reportId}`);

    const blocks = [];
    let order = 0;

    blocks.push({ reportId, blockType: "caseCrashes", refId: null, order: order++ });
    blocks.push({ reportId, blockType: "sevenDaysAverage", refId: null, order: order++ });

    console.log("Fetching displayed zone groups...");
    const [zoneGroups] = await queryInterface.sequelize.query(
      "SELECT `zoneGroupName` FROM `ZoneGroups` WHERE `display` = 1 ORDER BY `order` ASC",
      { transaction }
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
    const [customCharts] = await queryInterface.sequelize.query(
      "SELECT `id` FROM `CustomCharts` WHERE `visible` = 1 ORDER BY `id` ASC",
      { transaction }
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

    await queryInterface.bulkInsert("ReportBlocks", blocks, { transaction });
    console.log(`Inserted ${blocks.length} report block(s) total.`);

    console.log(
      "No UserReports subscriptions created — recipients must be configured manually after deploy."
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
    console.log("Rolling back: Remove default report seed...");

    const [existing] = await queryInterface.sequelize.query(
      "SELECT `id` FROM `Reports` WHERE `slug` = :slug",
      {
        replacements: { slug: DEFAULT_REPORT_SLUG },
        transaction,
      }
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
  }
}
