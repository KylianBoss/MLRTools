import { Router } from "express";
import { getDB } from "../database.js";
import { requirePermission } from "../middlewares/permissions.js";

const router = Router();

const ZONES = [
  "F013",
  "X001",
  "X002",
  "X003",
  "X101",
  "X102",
  "X103",
  "X104",
];

const CASE_TYPES = ["A", "B", "C", "E", "H", "U"];

// Get all case crashes (with their case types)
router.get(
  "/",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();

    try {
      const crashes = await db.models.CaseCrash.findAll({
        include: [
          {
            model: db.models.CaseCrashType,
            as: "caseTypes",
            attributes: ["caseType"],
          },
          {
            model: db.models.Users,
            as: "creator",
            attributes: ["fullname"],
          },
        ],
        order: [["crashDate", "DESC"]],
      });

      const formatted = crashes.map((crash) => {
        const data = crash.toJSON();
        return {
          ...data,
          caseTypes: data.caseTypes.map((t) => t.caseType),
          creatorFullname: data.creator?.fullname || data.createdBy,
          creator: undefined,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Error fetching case crashes:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Get the pivot table (dates x zones -> count)
router.get(
  "/pivot",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();

    try {
      const crashes = await db.models.CaseCrash.findAll({
        attributes: ["crashDate", "zone"],
        order: [["crashDate", "DESC"]],
      });

      const rows = new Map();

      for (const crash of crashes) {
        const date = crash.crashDate;
        if (!rows.has(date)) {
          const emptyRow = { date };
          ZONES.forEach((zone) => (emptyRow[zone] = 0));
          rows.set(date, emptyRow);
        }
        rows.get(date)[crash.zone] += 1;
      }

      res.json({
        zones: ZONES,
        rows: [...rows.values()],
      });
    } catch (error) {
      console.error("Error building case crashes pivot:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Create a new case crash
router.post(
  "/",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();
    const { crashDate, zone, caseTypes } = req.body;

    if (!crashDate) {
      return res.status(400).json({ error: "crashDate is required" });
    }

    if (!zone || !ZONES.includes(zone)) {
      return res.status(400).json({ error: "A valid zone is required" });
    }

    if (!Array.isArray(caseTypes) || caseTypes.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one case type is required" });
    }

    const invalidTypes = caseTypes.filter((t) => !CASE_TYPES.includes(t));
    if (invalidTypes.length > 0) {
      return res
        .status(400)
        .json({ error: `Invalid case types: ${invalidTypes.join(", ")}` });
    }

    const t = await db.transaction();
    try {
      const crash = await db.models.CaseCrash.create(
        {
          crashDate,
          zone,
          createdBy: req.userId,
        },
        { transaction: t }
      );

      await db.models.CaseCrashType.bulkCreate(
        [...new Set(caseTypes)].map((caseType) => ({
          caseCrashId: crash.id,
          caseType,
        })),
        { transaction: t }
      );

      await t.commit();

      const created = await db.models.CaseCrash.findByPk(crash.id, {
        include: [
          {
            model: db.models.CaseCrashType,
            as: "caseTypes",
            attributes: ["caseType"],
          },
        ],
      });

      const data = created.toJSON();
      res.status(201).json({
        ...data,
        caseTypes: data.caseTypes.map((ct) => ct.caseType),
      });
    } catch (error) {
      await t.rollback();
      console.error("Error creating case crash:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Update a case crash (only by creator)
router.patch(
  "/:id",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { crashDate, zone, caseTypes } = req.body;

    if (zone && !ZONES.includes(zone)) {
      return res.status(400).json({ error: "A valid zone is required" });
    }

    if (caseTypes !== undefined) {
      if (!Array.isArray(caseTypes) || caseTypes.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one case type is required" });
      }
      const invalidTypes = caseTypes.filter((t) => !CASE_TYPES.includes(t));
      if (invalidTypes.length > 0) {
        return res
          .status(400)
          .json({ error: `Invalid case types: ${invalidTypes.join(", ")}` });
      }
    }

    try {
      const crash = await db.models.CaseCrash.findByPk(id);

      if (!crash) {
        return res.status(404).json({ error: "Case crash not found" });
      }

      if (crash.createdBy !== req.userId) {
        return res
          .status(403)
          .json({ error: "Only the creator can modify this entry" });
      }

      const t = await db.transaction();
      try {
        await crash.update(
          {
            ...(crashDate && { crashDate }),
            ...(zone && { zone }),
          },
          { transaction: t }
        );

        if (caseTypes !== undefined) {
          await db.models.CaseCrashType.destroy({
            where: { caseCrashId: crash.id },
            transaction: t,
          });
          await db.models.CaseCrashType.bulkCreate(
            [...new Set(caseTypes)].map((caseType) => ({
              caseCrashId: crash.id,
              caseType,
            })),
            { transaction: t }
          );
        }

        await t.commit();
      } catch (error) {
        await t.rollback();
        throw error;
      }

      const updated = await db.models.CaseCrash.findByPk(id, {
        include: [
          {
            model: db.models.CaseCrashType,
            as: "caseTypes",
            attributes: ["caseType"],
          },
        ],
      });

      const data = updated.toJSON();
      res.json({
        ...data,
        caseTypes: data.caseTypes.map((ct) => ct.caseType),
      });
    } catch (error) {
      console.error("Error updating case crash:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete a case crash (only by creator)
router.delete(
  "/:id",
  requirePermission("canAccessCaseCrashes"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;

    try {
      const crash = await db.models.CaseCrash.findByPk(id);

      if (!crash) {
        return res.status(404).json({ error: "Case crash not found" });
      }

      if (crash.createdBy !== req.userId) {
        return res
          .status(403)
          .json({ error: "Only the creator can delete this entry" });
      }

      await crash.destroy();

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting case crash:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
