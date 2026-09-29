import { Router } from "express";
import { getDB } from "../database.js";
import { parseDurationText } from "../services/settingsDuration.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = getDB();
  try {
    const settings = await db.models.Settings.findAll({
      order: [["key", "ASC"]],
    });
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: error.message });
  }
});

const VALIDATORS = {
  duration: (value) =>
    parseDurationText(value)
      ? null
      : `Valeur invalide pour un paramètre de durée : "${value}" (format attendu, ex: "5 min", "10 sec", "7 jours")`,
  number: (value) =>
    Number.isFinite(Number(value)) && value !== "" && value != null
      ? null
      : `Valeur invalide pour un paramètre numérique : "${value}"`,
  date: (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime())
      ? null
      : `Valeur invalide pour un paramètre de date : "${value}" (format attendu AAAA-MM-JJ)`,
};

router.put("/:key", async (req, res) => {
  const db = getDB();
  const { key } = req.params;
  const { value } = req.body;
  try {
    const existing = await db.models.Settings.findByPk(key);

    const validate = existing && VALIDATORS[existing.type];
    const validationError = validate?.(value);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await db.models.Settings.upsert({
      key,
      value,
      updatedAt: new Date(),
    });
    const updated = await db.models.Settings.findByPk(key);
    res.json(updated);
  } catch (error) {
    console.error("Error updating setting:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
