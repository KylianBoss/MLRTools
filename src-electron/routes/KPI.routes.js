import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import { Op } from "sequelize";
import { v4 as uuid } from "uuid";
import PDFDocument from "pdfkit";
import fs from 'fs';
import path from "path";

const router = Router();
const printPDF = {};
const STORAGE_PATH = path.join(process.cwd(), "storage");

router.get("/count", async (req, res) => {
  const { from, to, includesExcluded = false } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query(
      "CALL getKPICount(:from, :to, :dataSource, :includesExcluded, :limit)",
      {
        replacements: {
          from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
          to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
          dataSource: "*", // All zones
          includesExcluded,
          limit: 10,
        },
      }
    ).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching KPI count:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/count/zone", async (req, res) => {
  const { from, to, includesExcluded = false, dataSource } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query(
      "CALL getKPICount(:from, :to, :dataSource, :includesExcluded, :limit)",
      {
        replacements: {
          from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
          to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
          dataSource,
          includesExcluded,
          limit: 5,
        },
      }
    ).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching KPI count:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/duration", async (req, res) => {
  const { from, to, includesExcluded = false } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query(
      "CALL getKPIDuration(:from, :to, :dataSource, :includesExcluded, :limit)",
      {
        replacements: {
          from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
          to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
          dataSource: "*", // All zones
          includesExcluded,
          limit: 10,
        },
      }
    ).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching KPI duration:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/resume", async (req, res) => {
  const { from, to, includesExcluded = false, dataSource } = req.query;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query("CALL getGroupedAlarms(:from, :to, :dataSource)", {
      replacements: {
        from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
        to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
        dataSource,
      },
    })
      .then((result) => {
        res.json(result);
      })
      .catch((error) => {
        console.error("Error fetching KPI resume:", error);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error("Error fetching KPI resume:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/groups", async (req, res) => {
  try {
    const groups = await db.models.ZoneGroups.findAll({
      attributes: ["zoneGroupName", "zones"],
      order: [["order", "ASC"]],
    });

    if (!groups || groups.length === 0) {
      return res.status(404).json({ error: "No KPI groups found" });
    }

    const zones = await db.models.Zones.findAll({
      attributes: ["zone", "zoneDescription"],
    });

    const formattedGroups = groups.map((group) => {
      const zoneDetails = zones
        .filter((z) => group.zones.includes(z.zone))
        .map((z) => ({
          zone: z.zone,
          description: z.zoneDescription,
        }));

      return {
        groupName: group.zoneGroupName,
        zones: zoneDetails,
        transportType: group.zoneTransportType,
      };
    });

    res.json(formattedGroups);
  } catch (error) {
    console.error("Error fetching KPI groups:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/thousand-trays-number/:groupName", async (req, res) => {
  const { groupName } = req.params;
  const WINDOW = 90;
  const MIN_PROD_TO_TAKE = 30000;

  const prodData = await db.models.ProductionData.findAll({
    attributes: ["date", "boxTreated"],
    where: {
      date: {
        [Op.gte]: dayjs().subtract(WINDOW, "day").format("YYYY-MM-DD"),
      },
    },
    order: [["date", "ASC"]],
    raw: true,
  });

  try {
    let dataNumbers = [];
    let dataTimes = [];

    for (let i = WINDOW - 1; i >= 0; i--) {
      const date = dayjs()
        .subtract(i + 1, "day")
        .format("YYYY-MM-DD");

      const dataNumber = await db.query(
        "CALL getErrorsByThousand(:from, :to, :groupName)",
        {
          replacements: {
            from: dayjs(date + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
            to: dayjs(date + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
            groupName,
          },
        }
      );
      dataNumbers.push({
        date,
        value: dataNumber[0].result || 0,
        trayAmount: dataNumber[0].trayAmount || 0,
        transportType: dataNumber[0].transportType || "unknown",
        minProdReached:
          (prodData.find((d) => d.date === date)?.boxTreated || 0) >=
          MIN_PROD_TO_TAKE,
      });

      const dataTime = await db.query(
        "CALL getDowntimeMinutesByThousand(:from, :to, :groupName)",
        {
          replacements: {
            from: dayjs(date + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
            to: dayjs(date + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
            groupName,
          },
        }
      );
      dataTimes.push({
        date,
        value: dataTime[0].result || 0,
        trayAmount: dataTime[0].trayAmount || 0,
        transportType: dataTime[0].transportType || "unknown",
        minProdReached:
          (prodData.find((d) => d.date === date)?.boxTreated || 0) >=
          MIN_PROD_TO_TAKE,
      });
    }

    const sortedDates = dataNumbers.map((d) => d.date).sort();

    const data = [];
    sortedDates.forEach((date) => {
      const numberEntry = dataNumbers.find((d) => d.date === date);
      const timeEntry = dataTimes.find((d) => d.date === date);
      data.push({
        date,
        number: numberEntry ? numberEntry.value : 0,
        time: timeEntry ? timeEntry.value : 0,
        trayAmount: numberEntry ? numberEntry.trayAmount : 0,
        transportType: numberEntry
          ? numberEntry.transportType
          : timeEntry
          ? timeEntry.transportType
          : "unknown",
        minProdReached: numberEntry
          ? numberEntry.minProdReached
          : timeEntry
          ? timeEntry.minProdReached
          : false,
      });
    });

    function calculateMovingAverage(data, windowSize = 7) {
      return data
        .map((item, index) => {
          const start = Math.max(0, index - windowSize + 1);
          const window = data.slice(start, index + 1).filter((d) => d.number > 0);

          const averageNumber =
            window.reduce((sum, point) => sum + point.number, 0) /
            window.length;
          const averageTime =
            window.reduce((sum, point) => sum + point.time, 0) / window.length;

          return {
            ...item,
            movingAverageNumber: Math.round(averageNumber * 100) / 100,
            movingAverageTime: Math.round(averageTime * 100) / 100,
          };
        });
    }

    res.json(calculateMovingAverage(data));
  } catch (error) {
    console.error("Error fetching KPI charts:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/global-last-7-days", async (req, res) => {
  try {
    const results = await db.query(
      "CALL getAverageErrorsAndDowntimeLast7Days()"
    );
    if (!results || results.length === 0) {
      return res
        .status(404)
        .json({ error: "No data found for the last 7 days" });
    }

    res.json(results[0]);
  } catch (error) {
    console.error("Error fetching global KPI charts:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/global-last-7-days/top-10", async (req, res) => {
  const from = dayjs()
    .subtract(7, "day")
    .startOf("day")
    .format("YYYY-MM-DD HH:mm:ss");
  const to = dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss");

  try {
    const alarms = await db.query(
      "CALL getTop10AlarmsWithDailyBreakdown(:from, :to, :groupName, false)",
      {
        replacements: {
          from,
          to,
          groupName: "*",
        },
      }
    );

    res.json(alarms);
  } catch (error) {
    console.error("Error fetching alarms globals for the last 7 days:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/alarms-by-group/:groupName", async (req, res) => {
  const { groupName } = req.params;
  const from = dayjs()
    .subtract(7, "day")
    .startOf("day")
    .format("YYYY-MM-DD HH:mm:ss");
  const to = dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss");

  try {
    const alarms = await db.query(
      "CALL getTop10AlarmsWithDailyBreakdown(:from, :to, :groupName, false)",
      {
        replacements: {
          from,
          to,
          groupName,
        },
      }
    );

    res.json(alarms);
  } catch (error) {
    console.error("Error fetching KPI alarms by group:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/custom/:chartId", async (req, res) => {
  const { chartId } = req.params;

  try {
    const customChartData = await db.models.CustomChart.findByPk(chartId);
    if (!customChartData) {
      return res.status(404).json({ error: "Custom chart not found" });
    }

    const chartData = await db.query("CALL getAlarmDataLast7Days(:alarmsIds)", {
      replacements: { alarmsIds: customChartData.alarms },
    });

    res.json(chartData[0]);
  } catch (error) {
    console.error("Error fetching custom chart data:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/print", async (req, res) => {
  const id = uuid();
  // printPDF[id] = [];

  fs.mkdirSync(path.join(STORAGE_PATH, 'prints', id), { recursive: true });

  res.json({ id });
});
router.post("/charts/print/:id", async (req, res) => {
  const { id } = req.params;
  const { image, index } = req.body;
  const dirPath = path.join(STORAGE_PATH, 'prints', id);

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Print session not found" });
  }
  // if (!printPDF[id]) {
  //   return res.status(404).json({ error: "Print session not found" });
  // }

  // printPDF[id].push(image);

  if (!image) {
    return res.status(400).json({ error: "No image provided" });
  }

  const imgBuffer = Buffer.from(
    image.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const imgName = `${index}.png`;
  const imgPath = path.join(STORAGE_PATH, 'prints', id, imgName);
  fs.writeFileSync(imgPath, imgBuffer);

  res.json({ status: "Image added to print session" });
});
router.get("/charts/print/:id", async (req, res) => {
  const { id } = req.params;

  // if (!printPDF[id]) {
  //   return res.status(404).json({ error: "Print session not found" });
  // }

  // const images = printPDF[id];
  const dirPath = path.join(STORAGE_PATH, 'prints', id);
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Print session not found" });
  }
  const images = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.png'))
    .sort((a, b) => {
      const aIndex = parseInt(a.split('.png')[0]);
      const bIndex = parseInt(b.split('.png')[0]);
      return aIndex - bIndex;
    })
    .map(file => fs.readFileSync(path.join(dirPath, file)));

  if (images.length === 0) {
    return res.status(404).json({ error: "No images in print session" });
  }
  const doc = new PDFDocument({
    autoFirstPage: false,
    layout: "landscape",
    margin: 36,
  });
  const buffers = [];
  doc.on("data", (buffer) => buffers.push(buffer));
  doc.on("end", () => {
    console.log("PDF generation completed");
    const pdfData = Buffer.concat(buffers);
    delete printPDF[id]; // Clear the session after fetching
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfData);
    fs.rmdirSync(dirPath, { recursive: true });
  });
  images.forEach((image) => {
    doc.addPage();
    doc.image(image, {
      fit: [doc.page.width - 72, doc.page.height - 72],
      align: "center",
      valign: "center",
    });
    console.log("Added image to PDF")
  });
  doc.end();
});
router.get("/charts/amount", async (req, res) => {
  try {
    const amount = await db.models.ZoneData.findAll({
      order: [["date", "ASC"]],
      where: {
        date: {
          [Op.gte]: dayjs().subtract(7, "day").format("YYYY-MM-DD"),
        },
        zoneName: [
          "X001",
          "X002",
          "X003",
          "X101",
          "X102",
          "X103",
          "X104",
          "X001_PAL",
          "X002_PAL",
          "X003_PAL",
          "F013",
        ],
      },
      attributes: ["date", "zoneName", "total"],
    });
    res.json(amount);
  } catch (error) {
    console.error("Error fetching tray amount:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
