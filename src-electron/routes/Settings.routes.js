import { Router } from "express";
import { getDB } from "../database.js";

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

router.put("/:key", async (req, res) => {
  const db = getDB();
  const { key } = req.params;
  const { value } = req.body;
  try {
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
