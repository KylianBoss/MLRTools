import { Router } from "express";
import { getDB } from "../database.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = getDB();
  try {
    const locations = await db.models.Location.findAll({
      order: [
        ["dataSource", "ASC"],
        ["lac", "ASC"],
        ["position", "ASC"],
      ],
    });

    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
