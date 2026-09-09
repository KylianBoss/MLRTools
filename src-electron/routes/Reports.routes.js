import { Router } from "express";
import { getDB } from "../database.js";
import { requirePermission } from "../middlewares/permissions.js";

const router = Router();

/**
 * Dérive un slug kebab-case depuis un nom de rapport.
 */
function slugify(name) {
  return name
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents (marques combinantes Unicode)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * [D8] Génère un slug unique : si le slug de base existe déjà, suffixe
 * automatiquement (-2, -3, ...) jusqu'à trouver un slug libre.
 */
async function generateUniqueSlug(db, name, excludeId = null) {
  const baseSlug = slugify(name) || "rapport";
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await db.models.Reports.findOne({ where: { slug: candidate } });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

// GET / : liste des rapports avec compte de blocs/abonnés
router.get("/", requirePermission("canAccessAdminReports"), async (req, res) => {
  const db = getDB();
  try {
    const reports = await db.models.Reports.findAll({
      order: [["id", "ASC"]],
    });

    const results = await Promise.all(
      reports.map(async (report) => {
        const blocksCount = await db.models.ReportBlocks.count({
          where: { reportId: report.id },
        });
        const subscribersCount = await db.models.UserReports.count({
          where: { reportId: report.id },
        });
        return {
          ...report.toJSON(),
          blocksCount,
          subscribersCount,
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /available-blocks : catalogue dynamique des blocs sélectionnables
// IMPORTANT : cette route doit rester déclarée AVANT "/:id" ci-dessous,
// sinon Express matcherait "available-blocks" comme la valeur de :id.
router.get(
  "/available-blocks",
  requirePermission("canAccessAdminReports"),
  async (req, res) => {
  const db = getDB();
  try {
    const zoneGroups = await db.models.ZoneGroups.findAll({
      where: { display: true },
      order: [["order", "ASC"]],
    });
    const customCharts = await db.models.CustomChart.findAll({
      where: { visible: true },
    });

    const staticBlocks = [
      { blockType: "caseCrashes", refId: null, label: "Chutes de tours de caisses" },
      { blockType: "sevenDaysAverage", refId: null, label: "Moyenne 7 jours" },
      {
        blockType: "plannedInterventions",
        refId: null,
        label: "Interventions planifiées",
      },
      {
        blockType: "unplannedInterventions",
        refId: null,
        label: "Interventions non-planifiées",
      },
    ];

    res.json([
      ...staticBlocks,
      ...zoneGroups.map((g) => ({
        blockType: "zoneGroup",
        refId: g.zoneGroupName,
        label: `Groupe: ${g.zoneGroupName}`,
      })),
      ...customCharts.map((c) => ({
        blockType: "customChart",
        refId: String(c.id),
        label: `Graphique: ${c.chartName}`,
      })),
    ]);
  } catch (error) {
    console.error("Error fetching available blocks:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id : détail d'un rapport avec ses blocs ordonnés (résolus avec un
// label lisible), utilisé par l'UI pour préremplir l'édition d'un rapport.
router.get("/:id", requirePermission("canAccessAdminReports"), async (req, res) => {
  const db = getDB();
  try {
    const reportId = parseInt(req.params.id, 10);
    const report = await db.models.Reports.findByPk(reportId, {
      include: [{ model: db.models.ReportBlocks, as: "blocks" }],
    });

    // [D5] Garde 404 systématique
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const customCharts = await db.models.CustomChart.findAll();

    const staticLabels = {
      caseCrashes: "Chutes de tours de caisses",
      sevenDaysAverage: "Moyenne 7 jours",
      plannedInterventions: "Interventions planifiées",
      unplannedInterventions: "Interventions non-planifiées",
    };

    const blocks = [...report.blocks]
      .sort((a, b) => a.order - b.order)
      .map((b) => {
        let label = staticLabels[b.blockType];
        if (b.blockType === "zoneGroup") {
          label = `Groupe: ${b.refId}`;
        } else if (b.blockType === "customChart") {
          const chart = customCharts.find((c) => String(c.id) === String(b.refId));
          label = `Graphique: ${chart ? chart.chartName : b.refId}`;
        }
        return {
          blockType: b.blockType,
          refId: b.refId,
          order: b.order,
          label: label || b.blockType,
        };
      });

    res.json({ ...report.toJSON(), blocks });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST / : créer un rapport (slug généré côté serveur, anti-collision [D8])
router.post("/", requirePermission("canCreateReports"), async (req, res) => {
  const db = getDB();
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const slug = await generateUniqueSlug(db, name);

    const report = await db.models.Reports.create({
      name,
      slug,
      description: description || null,
      active: true,
      createdBy: req.userId || null,
    });

    res.status(201).json(report);
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id : mettre à jour le nom/description d'un rapport (canUpdateReports).
// L'activation/désactivation passe par la route dédiée PUT /:id/active
// (canDeleteReports) — routes séparées pour que les 4 permissions [D11]
// contrôlent chacune exactement l'action qu'elle décrit.
router.put("/:id", requirePermission("canUpdateReports"), async (req, res) => {
  const db = getDB();
  try {
    const reportId = parseInt(req.params.id, 10);
    const report = await db.models.Reports.findByPk(reportId);

    // [D5] Garde 404 systématique
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const { name, description } = req.body;
    const updates = {};

    if (name !== undefined && name !== report.name) {
      updates.name = name;
      updates.slug = await generateUniqueSlug(db, name, reportId);
    }
    if (description !== undefined) updates.description = description;

    await report.update(updates);

    res.json(report);
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id/active : bascule active/inactive (soft delete [D3]). Route dédiée
// gardée par canDeleteReports, séparée de PUT /:id (canUpdateReports).
router.put("/:id/active", requirePermission("canDeleteReports"), async (req, res) => {
  const db = getDB();
  try {
    const reportId = parseInt(req.params.id, 10);
    const report = await db.models.Reports.findByPk(reportId);

    // [D5] Garde 404 systématique
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const { active } = req.body;
    if (typeof active !== "boolean") {
      res.status(400).json({ error: "active (boolean) is required" });
      return;
    }

    await report.update({ active });

    res.json(report);
  } catch (error) {
    console.error("Error toggling report active state:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id/blocks : remplace intégralement la liste ordonnée de blocs
router.put("/:id/blocks", requirePermission("canUpdateReports"), async (req, res) => {
  const db = getDB();
  try {
    const reportId = parseInt(req.params.id, 10);
    const report = await db.models.Reports.findByPk(reportId);

    // [D5] Garde 404 systématique
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const { blocks } = req.body;
    if (!Array.isArray(blocks)) {
      res.status(400).json({ error: "blocks must be an array" });
      return;
    }

    await db.models.ReportBlocks.destroy({ where: { reportId } });
    await db.models.ReportBlocks.bulkCreate(
      blocks.map((b, i) => ({
        reportId,
        blockType: b.blockType,
        refId: b.refId || null,
        order: i,
        config: b.config || null,
      }))
    );

    const updatedBlocks = await db.models.ReportBlocks.findAll({
      where: { reportId },
      order: [["order", "ASC"]],
    });

    res.json(updatedBlocks);
  } catch (error) {
    console.error("Error updating report blocks:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
