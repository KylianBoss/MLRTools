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

    // Set the targets to charts
    const chartsWithTargets = chartsWithUser.map(async (chart) => {
      const targets = await db.models.Target.findAll({
        where: { chartId: chart.id },
        order: [["setAt", "ASC"]],
      })

      chart.targets = targets.map((target) => target.toJSON());

      chart.targets.forEach(target => {
        target.setBy = userMap[target.setBy] || "Unknown";
      });
      return chart;
    });

    res.json(await Promise.all(chartsWithTargets));
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
  const { alarms, newTarget, setBy } = req.body;

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
    const target = await db.models.Target.findOne({
      where: {
        chartId: id,
      },
      order: [["setAt", "DESC"]],
      limit: 1,
    });
    if (target) chart.target = target.value;

    chart.alarms = alarms;

    if (newTarget !== undefined && setBy && newTarget !== chart.target) {
      await db.models.Target.upsert({
        chartId: id,
        value: newTarget,
        setBy: setBy,
      })
      chart.target = newTarget;
    }

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
