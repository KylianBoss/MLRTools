import { Router } from "express";
import { getDB } from "../database.js";
import dayjs from "dayjs";

const router = Router();

// --- Suivi en direct de la régénération du cache d'un graphique (SSE) ---
// Un client ouvre d'abord le flux SSE avec un jobId, puis lance le POST
// de régénération en référençant ce même jobId. La progression est
// poussée jour par jour au fil de l'eau.
const recalcStreams = new Map();

function pushRecalcEvent(jobId, payload) {
  const client = recalcStreams.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function endRecalcStream(jobId) {
  const client = recalcStreams.get(jobId);
  if (client) {
    client.end();
    recalcStreams.delete(jobId);
  }
}

router.get("/custom-charts/:id/recalculate/stream/:jobId", (req, res) => {
  const { jobId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      message: "Connexion établie, en attente de la régénération...",
    })}\n\n`
  );
  recalcStreams.set(jobId, res);

  req.on("close", () => {
    recalcStreams.delete(jobId);
  });
});

router.post("/custom-charts/:id/recalculate", async (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { jobId } = req.body;

  try {
    const chart = await db.models.CustomChart.findByPk(id);
    if (!chart) {
      res.status(404).json({ error: "Custom chart not found" });
      return;
    }

    // Répond tout de suite : le suivi se fait via le flux SSE
    res.json({ started: true });

    const MIN_DATE = await db.models.Settings.getValue("MIN_DATE");
    const MIN_ALARM_DURATION = await db.models.Settings.getValue(
      "MIN_ALARM_DURATION"
    );

    const startDate = dayjs(MIN_DATE).startOf("day");
    const endDate = dayjs().subtract(1, "day").startOf("day");
    const totalDays = Math.max(endDate.diff(startDate, "day") + 1, 0);

    pushRecalcEvent(jobId, {
      type: "start",
      totalDays,
      chartId: Number(id),
    });

    // Vide entièrement le cache de ce graphique avant de tout recalculer
    await db.models.cache_CustomCharts.destroy({ where: { chartId: id } });

    const dayDurations = [];
    let processedDays = 0;

    for (
      let current = startDate;
      current.isBefore(endDate) || current.isSame(endDate, "day");
      current = current.add(1, "day")
    ) {
      const dayStartedAt = Date.now();
      const dateStr = current.format("YYYY-MM-DD");

      try {
        await db.query(
          "CALL getCustomChartsData(:startDate, :endDate, :chartId, :minTime, NULL)",
          {
            replacements: {
              startDate: dateStr,
              endDate: dateStr,
              chartId: id,
              minTime: MIN_ALARM_DURATION,
            },
          }
        );
      } catch (dayError) {
        console.error(
          `Error recalculating chart ${id} for ${dateStr}:`,
          dayError
        );
        pushRecalcEvent(jobId, {
          type: "day-error",
          date: dateStr,
          error: dayError.message,
        });
      }

      processedDays += 1;
      dayDurations.push(Date.now() - dayStartedAt);
      // Ne garde qu'une fenêtre glissante récente pour estimer le temps restant
      if (dayDurations.length > 20) dayDurations.shift();

      const avgMsPerDay =
        dayDurations.reduce((sum, d) => sum + d, 0) / dayDurations.length;
      const remainingDays = totalDays - processedDays;
      const etaMs = Math.max(Math.round(avgMsPerDay * remainingDays), 0);

      pushRecalcEvent(jobId, {
        type: "progress",
        date: dateStr,
        processedDays,
        totalDays,
        percent:
          totalDays > 0 ? Math.round((processedDays / totalDays) * 100) : 100,
        etaMs,
      });
    }

    chart.updatedAt = new Date();
    await chart.save();

    pushRecalcEvent(jobId, {
      type: "done",
      processedDays,
      totalDays,
      updatedAt: chart.updatedAt,
    });
    endRecalcStream(jobId);
  } catch (error) {
    console.error("Error recalculating custom chart:", error);
    pushRecalcEvent(jobId, {
      type: "error",
      message: error.message,
    });
    endRecalcStream(jobId);
  }
});

router.get("/custom-charts/", async (req, res) => {
  const db = getDB();
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
      });

      chart.targets = targets.map((target) => target.toJSON());

      chart.targets.forEach((target) => {
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
  const db = getDB();
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
  const db = getDB();
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
      });
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
  const db = getDB();
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
router.get("/test-chart-image", async (req, res) => {
  const db = getDB();
  try {
    // Import dynamique pour éviter de charger la librairie si pas utilisé
    const { ChartJSNodeCanvas } = await import("chartjs-node-canvas");

    const width = 800; //px
    const height = 600; //px
    const backgroundColour = "white"; // Uses https://www.w3schools.com/tags/canvas_fillstyle.asp
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour,
    });

    const configuration = {
      type: "bar",
      data: {
        labels: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
        ],
        datasets: [
          {
            label: "My First dataset",
            backgroundColor: "rgb(255, 99, 132)",
            borderColor: "rgb(255, 99, 132)",
            data: [0, 10, 5, 2, 20, 30, 45],
          },
        ],
      },
      options: {},
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    res.set("Content-Type", "image/png");
    res.send(image);
  } catch (error) {
    console.error("Error generating test chart image:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

