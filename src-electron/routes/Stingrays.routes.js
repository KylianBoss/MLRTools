import { Router } from "express";
import dayjs from "dayjs";
import { Op } from "sequelize";
import { getDB } from "../database.js";
import { requirePermission } from "../middlewares/permissions.js";
import { applyStingrayStateChange } from "../services/stingrayState.js";

const router = Router();

const SHUTTLE_REGEX = /shuttle\s+(\d{1,3})\b/i;

// Poids par sévérité pour le calcul du score d'alarme. Les valeurs de
// `severity` observées dans le Datalog sont des libellés textuels TGW ;
// tout ce qui ne matche pas explicitement retombe sur le poids par défaut.
const SEVERITY_WEIGHTS = {
  critical: 3,
  high: 3,
  élevé: 3,
  medium: 2,
  moyen: 2,
  low: 1,
  faible: 1,
};
const DEFAULT_SEVERITY_WEIGHT = 1;

function severityWeight(severity) {
  if (!severity) return DEFAULT_SEVERITY_WEIGHT;
  const key = String(severity).trim().toLowerCase();
  return SEVERITY_WEIGHTS[key] ?? DEFAULT_SEVERITY_WEIGHT;
}

/**
 * Calcule le niveau d'alarme (ok/warning/critical) de chaque stingray à
 * partir du Datalog, sur une fenêtre glissante configurable. Une seule
 * requête agrégée pour tous les stingrays (pas une requête par stingray).
 *
 * @param {object} db
 * @returns {Promise<Map<number, {count: number, score: number, level: string}>>}
 */
async function computeAlarmLevels(db) {
  const [windowDays, warnThreshold, criticalThreshold] = await Promise.all([
    db.models.Settings.getValue("STINGRAY_ALARM_WINDOW_DAYS"),
    db.models.Settings.getValue("STINGRAY_ALARM_WARN_THRESHOLD"),
    db.models.Settings.getValue("STINGRAY_ALARM_CRITICAL_THRESHOLD"),
  ]);

  const since = dayjs()
    .subtract(Number(windowDays) || 30, "day")
    .toDate();

  const rows = await db.models.Datalog.findAll({
    where: {
      timeOfOccurence: { [Op.gte]: since },
      alarmText: { [Op.like]: "%Shuttle %" },
    },
    attributes: ["alarmText", "severity"],
  });

  const warn = Number(warnThreshold) || 5;
  const critical = Number(criticalThreshold) || 15;

  const byNumber = new Map();
  for (const row of rows) {
    const match = row.alarmText?.match(SHUTTLE_REGEX);
    if (!match) continue;
    const number = parseInt(match[1], 10);
    const entry = byNumber.get(number) || { count: 0, score: 0 };
    entry.count += 1;
    entry.score += severityWeight(row.severity);
    byNumber.set(number, entry);
  }

  for (const entry of byNumber.values()) {
    entry.level =
      entry.score >= critical ? "critical" : entry.score >= warn ? "warning" : "ok";
  }

  return byNumber;
}

/**
 * Retourne les alarmes détaillées du Datalog pour un numéro de stingray
 * donné, sur la même fenêtre glissante que le calcul du niveau d'alarme.
 */
async function getRecentAlarmsForStingray(db, number) {
  const windowDays = await db.models.Settings.getValue(
    "STINGRAY_ALARM_WINDOW_DAYS"
  );
  const since = dayjs()
    .subtract(Number(windowDays) || 30, "day")
    .toDate();

  const rows = await db.models.Datalog.findAll({
    where: {
      timeOfOccurence: { [Op.gte]: since },
      alarmText: { [Op.like]: `%Shuttle ${number}%` },
    },
    order: [["timeOfOccurence", "DESC"]],
  });

  // `LIKE '%Shuttle 4%'` matcherait aussi "Shuttle 42" : re-filtrer avec la regex exacte
  return rows
    .map((r) => r.toJSON())
    .filter((r) => {
      const match = r.alarmText?.match(SHUTTLE_REGEX);
      return match && parseInt(match[1], 10) === Number(number);
    });
}

// GET /stingrays - liste de tous les stingrays avec état, position et alarme
router.get("/", requirePermission("canAccessStingrays"), async (req, res) => {
  const db = getDB();
  try {
    const { state, aisleId } = req.query;
    const where = {};
    if (state) where.state = state;
    if (aisleId) where.currentAisleId = aisleId;

    const [stingrays, alarmLevels] = await Promise.all([
      db.models.Stingray.findAll({
        where,
        include: [{ model: db.models.Aisle, as: "currentAisle" }],
        order: [["number", "ASC"]],
      }),
      computeAlarmLevels(db),
    ]);

    const result = stingrays.map((s) => {
      const data = s.toJSON();
      const alarm = alarmLevels.get(data.number) || {
        count: 0,
        score: 0,
        level: "ok",
      };
      return {
        ...data,
        alarmLevel: alarm.level,
        alarmCount: alarm.count,
        alarmScore: alarm.score,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching stingrays:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stingrays/aisles - les 6 allées, avec leur nombre d'étages occupés
router.get(
  "/aisles",
  requirePermission("canAccessStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const where = { currentAisleId: { [Op.ne]: null } };
      if (req.query.excludeStingrayId) {
        where.id = { [Op.ne]: req.query.excludeStingrayId };
      }

      const [aisles, occupiedCounts] = await Promise.all([
        db.models.Aisle.findAll({ order: [["name", "ASC"]] }),
        db.models.Stingray.findAll({
          where,
          attributes: [
            "currentAisleId",
            [db.fn("COUNT", db.col("id")), "count"],
          ],
          group: ["currentAisleId"],
          raw: true,
        }),
      ]);

      const countByAisle = new Map(
        occupiedCounts.map((r) => [r.currentAisleId, Number(r.count)])
      );

      res.json(
        aisles.map((a) => ({
          ...a.toJSON(),
          occupiedCount: countByAisle.get(a.id) || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching aisles:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /stingrays/aisles/:aisleId/occupied-floors - étages déjà occupés dans une allée
router.get(
  "/aisles/:aisleId/occupied-floors",
  requirePermission("canAccessStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const where = { currentAisleId: req.params.aisleId };
      if (req.query.excludeStingrayId) {
        where.id = { [Op.ne]: req.query.excludeStingrayId };
      }
      const occupied = await db.models.Stingray.findAll({
        where,
        attributes: ["currentFloor"],
      });
      res.json(occupied.map((s) => s.currentFloor).filter((f) => f !== null));
    } catch (error) {
      console.error("Error fetching occupied floors:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /stingrays/alarm-settings - seuils configurables actuels
router.get(
  "/alarm-settings",
  requirePermission("canManageStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const [windowDays, warnThreshold, criticalThreshold] = await Promise.all([
        db.models.Settings.getValue("STINGRAY_ALARM_WINDOW_DAYS"),
        db.models.Settings.getValue("STINGRAY_ALARM_WARN_THRESHOLD"),
        db.models.Settings.getValue("STINGRAY_ALARM_CRITICAL_THRESHOLD"),
      ]);
      res.json({
        windowDays: Number(windowDays) || 30,
        warnThreshold: Number(warnThreshold) || 5,
        criticalThreshold: Number(criticalThreshold) || 15,
      });
    } catch (error) {
      console.error("Error fetching stingray alarm settings:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /stingrays/alarm-settings - modifier les seuils
router.patch(
  "/alarm-settings",
  requirePermission("canManageStingrays"),
  async (req, res) => {
    const db = getDB();
    const { windowDays, warnThreshold, criticalThreshold } = req.body;
    try {
      const updates = [
        ["STINGRAY_ALARM_WINDOW_DAYS", windowDays],
        ["STINGRAY_ALARM_WARN_THRESHOLD", warnThreshold],
        ["STINGRAY_ALARM_CRITICAL_THRESHOLD", criticalThreshold],
      ].filter(([, value]) => value !== undefined && value !== null);

      for (const [key, value] of updates) {
        await db.models.Settings.upsert({
          key,
          value: String(value),
          updatedBy: req.userId,
          updatedAt: new Date(),
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating stingray alarm settings:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /stingrays/:id - détail d'un stingray + alarmes récentes
// GET /stingrays/by-number/:number - lookup léger pour le voyage rapide
// (déclarée avant /:id pour ne pas être capturée par cette route générique)
router.get(
  "/by-number/:number",
  requirePermission("canAccessStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const stingray = await db.models.Stingray.findOne({
        where: { number: req.params.number },
        attributes: ["id", "number"],
      });
      if (!stingray) {
        return res.status(404).json({ error: "Stingray not found" });
      }
      res.json(stingray.toJSON());
    } catch (error) {
      console.error("Error fetching stingray by number:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/:id",
  requirePermission("canAccessStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const stingray = await db.models.Stingray.findByPk(req.params.id, {
        include: [{ model: db.models.Aisle, as: "currentAisle" }],
      });
      if (!stingray) {
        return res.status(404).json({ error: "Stingray not found" });
      }

      const recentAlarms = await getRecentAlarmsForStingray(
        db,
        stingray.number
      );

      res.json({ ...stingray.toJSON(), recentAlarms });
    } catch (error) {
      console.error("Error fetching stingray:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /stingrays - créer un nouveau stingray
router.post(
  "/",
  requirePermission("canManageStingrays"),
  async (req, res) => {
    const db = getDB();
    const { number, serialNumber, state, notes } = req.body;

    if (!number) {
      return res.status(400).json({ error: "number is required" });
    }

    try {
      const stingray = await db.models.Stingray.create({
        number,
        serialNumber: serialNumber || null,
        state: state || "spare",
        notes: notes || null,
      });
      res.status(201).json(stingray.toJSON());
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        return res
          .status(409)
          .json({ error: `Le stingray n°${number} existe déjà` });
      }
      console.error("Error creating stingray:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /stingrays/:id - modification directe (hors intervention)
router.patch(
  "/:id",
  requirePermission("canManageStingrays"),
  async (req, res) => {
    const db = getDB();
    const { serialNumber, notes, state } = req.body;

    try {
      const stingray = await db.models.Stingray.findByPk(req.params.id);
      if (!stingray) {
        return res.status(404).json({ error: "Stingray not found" });
      }

      // Si l'état change, passer par applyStingrayStateChange pour que la
      // position soit correctement répercutée (sortie d'allée le cas échéant).
      if (state && state !== stingray.state) {
        await applyStingrayStateChange(db, {
          stingrayId: stingray.id,
          newState: state,
          changedBy: req.userId,
        });
      }

      const updateData = {};
      if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
      if (notes !== undefined) updateData.notes = notes;
      if (Object.keys(updateData).length > 0) {
        await stingray.update(updateData);
      }

      await stingray.reload();
      res.json(stingray.toJSON());
    } catch (error) {
      console.error("Error updating stingray:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /stingrays/:id/position-history - historique complet, trié
router.get(
  "/:id/position-history",
  requirePermission("canAccessStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const stingray = await db.models.Stingray.findByPk(req.params.id);
      if (!stingray) {
        return res.status(404).json({ error: "Stingray not found" });
      }

      const history = await db.models.StingrayPositionHistory.findAll({
        where: { stingrayId: req.params.id },
        include: [
          { model: db.models.Aisle, as: "aisle" },
          { model: db.models.Users, as: "mover", attributes: ["fullname"] },
        ],
        order: [["movedAt", "DESC"]],
      });

      // leftAt d'une entrée = movedAt de l'entrée suivante (plus récente) dans le tri DESC
      const formatted = history.map((entry, index) => {
        const data = entry.toJSON();
        return {
          ...data,
          moverFullname: data.mover?.fullname || null,
          mover: undefined,
          leftAt: index === 0 ? null : history[index - 1].movedAt,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Error fetching stingray position history:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /stingrays/:id/position-history - nouvelle position
router.post(
  "/:id/position-history",
  requirePermission("canManageStingrays"),
  async (req, res) => {
    const db = getDB();
    const { aisleId, floor, locationLabel, movedAt, comment } = req.body;

    try {
      const stingray = await db.models.Stingray.findByPk(req.params.id);
      if (!stingray) {
        return res.status(404).json({ error: "Stingray not found" });
      }

      if (aisleId) {
        const aisle = await db.models.Aisle.findByPk(aisleId);
        if (!aisle) {
          return res.status(400).json({ error: "Aisle not found" });
        }
        if (!floor || floor < 1 || floor > aisle.floorsCount) {
          return res.status(400).json({
            error: `floor must be between 1 and ${aisle.floorsCount} for this aisle`,
          });
        }
        const occupied = await db.models.Stingray.findOne({
          where: {
            currentAisleId: aisleId,
            currentFloor: floor,
            id: { [Op.ne]: stingray.id },
          },
        });
        if (occupied) {
          return res.status(409).json({
            error: `Position already occupied by stingray ${occupied.number}`,
          });
        }
      }

      const entry = await db.models.StingrayPositionHistory.create({
        stingrayId: stingray.id,
        aisleId: aisleId || null,
        floor: aisleId ? floor : null,
        locationLabel: aisleId ? null : locationLabel || null,
        movedAt: movedAt || new Date(),
        movedBy: req.userId,
        comment: comment || null,
      });

      await stingray.update({
        currentAisleId: aisleId || null,
        currentFloor: aisleId ? floor : null,
        // Une position en allée implique de fait que le stingray est en service
        state: aisleId ? "in_service" : stingray.state,
      });

      res.status(201).json(entry.toJSON());
    } catch (error) {
      console.error("Error creating stingray position:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /stingrays/:id/interventions - journal filtré pour ce stingray
router.get(
  "/:id/interventions",
  requirePermission("canAccessStingrays"),
  async (req, res) => {
    const db = getDB();
    try {
      const stingray = await db.models.Stingray.findByPk(req.params.id);
      if (!stingray) {
        return res.status(404).json({ error: "Stingray not found" });
      }

      const interventions = await db.models.Intervention.findAll({
        where: { stingrayId: req.params.id },
        include: [
          { model: db.models.Users, as: "creator", attributes: ["fullname"] },
        ],
        order: [
          ["plannedDate", "DESC"],
          ["createdAt", "DESC"],
        ],
      });

      const formatted = interventions.map((i) => {
        const data = i.toJSON();
        return {
          ...data,
          creatorFullname: data.creator?.fullname || data.createdBy,
          creator: undefined,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error("Error fetching stingray interventions:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
