import { Router } from "express";
import { db } from "../database.js";

const router = Router();

router.get("/custom-charts/", async (req, res) => {
  try {
    const charts = await db.models.CustomChart.findAll({
      order: [["chartName", "ASC"]],
    });

    const userIds = [...new Set(charts.map((chart) => chart.createdBy))];
    const users = await db.models.Users.findAll({
      where: { id: userIds },
      attributes: ["id", "fullname"],
    });
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user.fullname;
      return acc;
    }, {});

    const chartsWithUser = charts.map((chart) => {
      const chartData = chart.toJSON();
      chartData.createdByName = userMap[chart.createdBy] || "Unknown";
      return chartData;
    });

    res.json(chartsWithUser);
  } catch (error) {
    console.error("Error fetching custom charts:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/custom-charts/", async (req, res) => {
  const { chartName, alarms, createdBy } = req.body;
  if (
    !chartName ||
    !Array.isArray(alarms) ||
    alarms.length === 0 ||
    !createdBy
  ) {
    res
      .status(400)
      .json({ error: "chartName, alarms, and createdBy are required" });
    return;
  }

  try {
    const newChart = await db.models.CustomChart.create({
      chartName,
      alarms: alarms,
      createdBy,
    });
    res.json(newChart.toJSON());
  } catch (error) {
    console.error("Error creating custom chart:", error);
    res.status(500).json({ error: error.message });
  }
});
router.put("/custom-charts/:id", async (req, res) => {
  const { id } = req.params;
  const { alarms } = req.body;

  if (!id || !Array.isArray(alarms) || alarms.length === 0) {
    res.status(400).json({ error: "Valid id and alarms are required" });
    return;
  }

  try {
    const chart = await db.models.CustomChart.findByPk(id);
    if (!chart) {
      res.status(404).json({ error: "Custom chart not found" });
      return;
    }

    chart.alarms = alarms;
    await chart.save();
    res.json(chart.toJSON());
  } catch (error) {
    console.error("Error updating custom chart:", error);
    res.status(500).json({ error: error.message });
  }
});
router.delete("/custom-charts/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Valid id is required" });
    return;
  }

  try {
    const chart = await db.models.CustomChart.findByPk(id);
    if (!chart) {
      res.status(404).json({ error: "Custom chart not found" });
      return;
    }

    await chart.destroy();
    res.json({ message: "Custom chart deleted" });
  } catch (error) {
    console.error("Error deleting custom chart:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
