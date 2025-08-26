import { Router } from "express";
import { db } from "../database.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const locations = await db.models.Location.findAll({
      order: [
        ["dataSource", "ASC"],
        ["module", "ASC"],
        ["complement", "ASC"],
      ],
    });

    const locationsWithDetails = await Promise.all(
      locations.map(async (location) => {
        const element = await db.models.Element.findByPk(location.element, {
          attributes: ["name"],
        });
        return {
          ...location.toJSON(),
          element: element ? element.name : "N/A",
        };
      })
    );

    res.json(locationsWithDetails);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
