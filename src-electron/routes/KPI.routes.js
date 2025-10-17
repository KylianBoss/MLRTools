import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import { Op } from "sequelize";
import { v4 as uuid } from "uuid";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const router = Router();
const STORAGE_PATH = path.join(process.cwd(), "storage");
const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");

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
  const MOVING_AVERAGE_WINDOW = await db.models.Settings.getValue(
    "MOVING_AVERAGE_WINDOW"
  );
  const GRAPH_TABLE_WINDOW = await db.models.Settings.getValue(
    "GRAPH_TABLE_WINDOW"
  );
  const MIN_PROD_TO_TAKE = await db.models.Settings.getValue(
    "MIN_PROD_TO_TAKE"
  );
  const WINDOW = await db.models.Settings.getValue("GRAPH_WINDOW");
  const { groupName } = req.params;
  const from = dayjs()
    .subtract(GRAPH_TABLE_WINDOW, "day")
    .startOf("day")
    .format("YYYY-MM-DD HH:mm:ss");
  const to = dayjs()
    .subtract(1, "day")
    .endOf("day")
    .format("YYYY-MM-DD HH:mm:ss");

  try {
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

    const chartData = [];
    for (let i = WINDOW - 1; i >= 0; i--) {
      const date = dayjs()
        .subtract(i + 1, "day")
        .format("YYYY-MM-DD");
      const data = await db.query("CALL getChartData(:date, :groupName)", {
        replacements: {
          date,
          groupName,
        },
      });

      chartData.push({
        groupName: data[0].groupName,
        transportType: data[0].transportType,
        errors: data[0].errors,
        downtime: data[0].downtime,
        traysAmount: data[0].traysAmount,
        date,
      });
    }

    filledChartData = chartData.map((data, index) => {
      const start = Math.max(0, index - MOVING_AVERAGE_WINDOW + 1);
      const window = chartData
        .slice(start, index + 1)
        .filter((d) => d.errors > 0);

      const averageErrors =
        window.reduce((sum, point) => sum + parseFloat(point.errors), 0) /
        window.length;
      const averageDowntime =
        window.reduce((sum, point) => sum + point.downtime, 0) / window.length;

      return {
        ...data,
        movingAverageErrors:
          averageErrors > 0 ? Math.round(averageErrors * 100) / 100 : 0,
        movingAverageDowntime:
          averageDowntime > 0 ? Math.round(averageDowntime * 100) / 100 : 0,
        minProdReached:
          (prodData.find((d) => d.date === data.date)?.boxTreated || 0) >=
          MIN_PROD_TO_TAKE,
      };
    });

    res.json({
      alarms,
      chartData: filledChartData,
    });
  } catch (error) {
    console.error("Error fetching KPI alarms by group:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/custom/:chartId", async (req, res) => {
  const { chartId } = req.params;

  const MOVING_AVERAGE_WINDOW = await db.models.Settings.getValue(
    "MOVING_AVERAGE_WINDOW"
  );

  try {
    const customChartData = await db.models.CustomChart.findByPk(chartId);
    if (!customChartData) {
      return res.status(404).json({ error: "Custom chart not found" });
    }

    const chartData = await db.query(
      "CALL getAlarmDataLast7Days(15, :alarmsIds)",
      {
        replacements: { alarmsIds: customChartData.alarms },
      }
    );

    function calculateMovingAverage(data, windowSize = 7) {
      const dailyBreakdown = JSON.parse(data.dailyBreakdown);

      return {
        ...data,
        dailyBreakdown: dailyBreakdown.map((item, index) => {
          const start = Math.max(0, index - windowSize + 1);
          const window = dailyBreakdown
            .slice(start, index + 1)
            .filter((d) => d.total_count > 0);

          const averageNumber =
            window.reduce((sum, point) => sum + point.total_count, 0) /
            window.length;

          return {
            ...item,
            movingAverage: Math.round(averageNumber * 100) / 100,
          };
        }),
      };

      return data.map((item, index) => {
        const start = Math.max(0, index - windowSize + 1);
        const window = data
          .slice(start, index + 1)
          .filter((d) => d.total_count > 0);

        const averageNumber =
          window.reduce((sum, point) => sum + point.total_count, 0) /
          window.length;

        return {
          ...item,
          movingAverage: Math.round(averageNumber * 100) / 100,
        };
      });
    }

    res.json(calculateMovingAverage(chartData[0], MOVING_AVERAGE_WINDOW));
  } catch (error) {
    console.error("Error fetching custom chart data:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/charts/print", async (req, res) => {
  const id = uuid();

  fs.mkdirSync(path.join(STORAGE_PATH, "prints", id), { recursive: true });

  res.json({ id });
});
router.post("/charts/print/:id/finalize-and-send", async (req, res) => {
  const { id } = req.params;
  const dirPath = path.join(STORAGE_PATH, "prints", id);
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Print session not found" });
  }

  const images = fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => {
      const aIndex = parseInt(a.split(".png")[0]);
      const bIndex = parseInt(b.split(".png")[0]);
      return aIndex - bIndex;
    })
    .map((file) => fs.readFileSync(path.join(dirPath, file)));
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
    fs.writeFileSync(
      path.join(
        STORAGE_PATH,
        "prints",
        id,
        `KPI_${dayjs().subtract(1, "day").format("YYYY_MM_DD")}.pdf`
      ),
      pdfData
    );

    // Send by mail
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    if (!config.email || !config.email.enabled) {
      console.log("Email sending is disabled in configuration.");
      fs.rmSync(dirPath, { recursive: true });
      return res.sendStatus(200);
    }

    // Get all users with recieveDailyReport set to true
    db.models.Users.findAll({
      where: { recieveDailyReport: true },
    }).then((users) => {
      if (!users || users.length === 0) {
        console.log("No users configured to receive daily report.");
        fs.rmSync(dirPath, { recursive: true });
        return res.sendStatus(200);
      }
      const recipientEmails = users
        .map((u) => u.email)
        .filter((email) => email && email.includes("@"));

      const transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: false,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });

      const mailOptions = {
        from: `MLR Tool <${config.email.user}>`,
        to: recipientEmails,
        subject: `KPI Daily Report - ${dayjs()
          .subtract(1, "day")
          .format("YYYY-MM-DD")}`,
        text: `
Bonjour,
Hallo,
Hello,

Voici les KPI machine des 7 derniers jours.
Hier sind die Maschinen-KPIs der letzten 7 Tage.
Here are the machine's KPIs for the last 7 days.

Bonne lecture, bonne journée.
Viel Spaß beim Lesen, einen schönen Tag noch.
Enjoy your reading, have a nice day.

-----------------------------------------------------------------------

Ceci est un email généré automatiquement, merci de ne pas y répondre.
Dies ist eine automatisch generierte E-Mail, bitte nicht antworten.
This is an automatically generated email, please do not reply.`,
        attachments: [
          {
            filename: `KPI_${dayjs()
              .subtract(1, "day")
              .format("YYYY_MM_DD")}.pdf`,
            content: pdfData,
          },
        ],
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending KPI report email:", error);
        } else {
          console.log("KPI report email sent:", info.response);
        }
        fs.rmSync(dirPath, { recursive: true });
      });
      global.sendCommandToFrontend("router", { path: "home" });
      res.sendStatus(200);
    });
  });
  images.forEach((image) => {
    doc.addPage();
    doc.image(image, {
      fit: [doc.page.width - 72, doc.page.height - 72],
      align: "center",
      valign: "center",
    });
    console.log("Added image to PDF");
  });
  doc.end();
});
router.post("/charts/print/:id", async (req, res) => {
  const { id } = req.params;
  const { image, index } = req.body;
  const dirPath = path.join(STORAGE_PATH, "prints", id);

  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Print session not found" });
  }

  if (!image) {
    return res.status(400).json({ error: "No image provided" });
  }

  const imgBuffer = Buffer.from(
    image.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const imgName = `${index}.png`;
  const imgPath = path.join(STORAGE_PATH, "prints", id, imgName);
  fs.writeFileSync(imgPath, imgBuffer);

  res.json({ status: "Image added to print session" });
});
router.get("/charts/print/:id", async (req, res) => {
  const { id } = req.params;

  const dirPath = path.join(STORAGE_PATH, "prints", id);
  if (!fs.existsSync(dirPath)) {
    return res.status(404).json({ error: "Print session not found" });
  }
  const images = fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => {
      const aIndex = parseInt(a.split(".png")[0]);
      const bIndex = parseInt(b.split(".png")[0]);
      return aIndex - bIndex;
    })
    .map((file) => fs.readFileSync(path.join(dirPath, file)));

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
    console.log("Added image to PDF");
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
