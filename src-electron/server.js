import { db } from "./database";
import { QueryTypes, Op } from "sequelize";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import PDFdocument from "pdfkit-table";
import fs from "fs/promises";
import path from "path";
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { extractTrayAmount } from "./cron/ExtractTrayAmount.js";
import cron from "node-cron";

dayjs.extend(duration);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// === COMMUNICATION TO ELECTRON === //
let electronClients = [];
app.get("/sse", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  console.log("Electron client connected via SSE");
  electronClients.push(res);

  res.write('data: {"type":"connected","message":"SSE connected"}\n\n');

  req.on("close", () => {
    console.log("Electron client disconnected");
    electronClients = electronClients.filter((client) => client !== res);
  });
});
function sendNotificationToElectron(title, body) {
  const data = JSON.stringify({
    type: "notification",
    title,
    body,
    timestamp: new Date().toISOString(),
  });

  electronClients.forEach((client) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error("SSE send error:", error);
    }
  });
}
global.sendNotificationToElectron = sendNotificationToElectron;

// === ROUTES === //
app.get("/extract/:date", (req, res) => {
  const { date } = req.params;
  if (!date) {
    res.status(400).json({ error: "No date provided" });
    return;
  }
  extractTrayAmount(date);
  res.json({ message: "Extraction started" });
});
app.use(routes);

app.post("/alarms/zone/:alarmId", async (req, res) => {
  const { zones } = req.body;
  console.log("Updating alarm zone:", req.params.alarmId, zones);
  try {
    const alarm = await db.models.Alarms.findOne({
      where: {
        alarmId: req.params.alarmId,
      },
    });
    if (!alarm) {
      res.status(404).json({ error: "Alarm not found" });
      return;
    }

    // if (
    //   zone === null &&
    //   zone2 === null &&
    //   zone3 === null &&
    //   zone4 === null &&
    //   zone5 === null
    // ) {
    //   await db.models.alarmZoneTGWReport.destroy({
    //     where: {
    //       alarmId: req.params.alarmId,
    //     },
    //   });
    //   res.json(null);
    //   return;
    // }

    // await db.models.alarmZoneTGWReport.destroy({
    //   where: {
    //     alarmId: req.params.alarmId,
    //   },
    // });
    // const newZone = await db.models.alarmZoneTGWReport.create({
    //   alarmId: req.params.alarmId,
    //   zone,
    //   zone2,
    //   zone3,
    //   zone4,
    //   zone5,
    // });

    const newZone = await db.models.alarmZoneTGWReport.upsert({
      alarmId: alarm.alarmId,
      zones,
    });

    console.log("Alarm zone updated");
    res.json(newZone);
  } catch (error) {
    console.error("Error updating alarm zone:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/alarms/:alarmIdCode", async (req, res) => {
  const { alarmIdCode } = req.params;

  if (!alarmIdCode) {
    res.status(400).json({ error: "No alarm ID provided" });
    return;
  }

  try {
    const alarm = await db.models.Alarms.findOne({
      where: {
        [Op.or]: [{ alarmId: alarmIdCode }, { alarmCode: alarmIdCode }],
      },
    });
    res.json(alarm.toJSON());
  } catch (error) {
    console.error("Error fetching alarm:", error);
    res.status(500).json({ error: error.message });
  }
});

// PRODUCTION DATA
app.get("/production/data", async (req, res) => {
  try {
    const data = await db.models.ProductionData.findAll({
      order: [["date", "ASC"]],
      raw: true,
    });
    res.json(data);
  } catch (error) {
    console.error("Error fetching production data:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/production/data", async (req, res) => {
  const { date, start, end, dayOff, boxTreated } = req.body;
  try {
    await db.models.ProductionData.upsert({
      date,
      start,
      end,
      dayOff,
      boxTreated,
    });
    const data = await db.models.ProductionData.findOne({
      where: {
        date,
      },
    });
    res.json(data.dataValues);
  } catch (error) {
    console.error("Error creating production time:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/print/suspicious-places", async (req, res) => {
  const { places } = req.body;
  const doc = new PDFdocument({
    size: "A4",
    layout: "landscape",
    margin: 30,
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => {
    // Send base64 encoded PDF to the renderer
    const pdfBuffer = Buffer.concat(chunks).toString("base64");
    res.json(pdfBuffer);
  });
  doc
    .fontSize(20)
    .text("Emplacements suspects dans le Shuttle", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).text("Liste des emplacements suspects");
  doc.moveDown();
  doc.fontSize(12);
  // Make a table with the place data
  // {
  //  aisle: 1,
  //  side: Gauche,
  //  level: 10,
  //  maintenanceLevel: 5,
  //  rack: 10,
  //  x: 3,
  //  z: 2,
  //  trayNumber: 0000023564,
  // }
  const table = {
    headers: [
      "Allée",
      "Côté",
      "Maintenance Level",
      "Étagère",
      "Compartiment",
      "Place",
      "Profondeur",
      "Numéro du tray",
      "Actuel",
    ],
    rows: places.map((p) => [
      p.aisle,
      p.side,
      p.maintenanceLevel,
      p.level,
      p.rack,
      p.x,
      p.z,
      p.trayNumber,
      "",
    ]),
  };
  doc
    .table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold"),
      prepareRow: (row, i) => doc.font("Helvetica").fontSize(12),
    })
    .then(() => doc.end());
});

// CHARTS
app.get("/charts/messages-count/:startDate/:endDate", async (req, res) => {
  const { startDate, endDate } = req.params;
  try {
    // Get the number of messages per day between the start and end dates (inclusive) and separate WARNING and ERROR messages
    const result = await db.query(
      `
        SELECT
          DATE(timeOfOccurence) as date,
          SUM(CASE WHEN severity = 'Warning' THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN severity = 'Error' THEN 1 ELSE 0 END) as error,
          COUNT(*) as total
        FROM
          Datalogs
        WHERE
          timeOfOccurence BETWEEN :startDate AND :endDate
        GROUP BY
          date
        ORDER BY
          date
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching message count:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/charts/messages-per-zone/:startDate/:endDate", async (req, res) => {
  const { startDate, endDate } = req.params;
  try {
    // Get the number of messages per zone between the start and end dates (inclusive)
    const result = await db.query(
      `
        SELECT
          dataSource,
          SUM(CASE WHEN severity = 'Error' THEN 1 ELSE 0 END) as count
        FROM
          DatalogsWithoutExcluded
        WHERE
          timeOfOccurence BETWEEN :startDate AND :endDate
        GROUP BY
          dataSource
        ORDER BY
          count DESC
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching message count:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/charts/production/volume/:startDate/:endDate", async (req, res) => {
  const { startDate, endDate } = req.params;
  try {
    // Get the number of boxes treated per day between the start and end dates (inclusive)
    const result = await db.query(
      `
        SELECT
          date,
          boxTreated
        FROM
          ProductionData
        WHERE
          date BETWEEN :startDate AND :endDate
        ORDER BY
          date
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching production volume:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fonction pour démarrer le serveur
function startServer() {
  return new Promise((resolve, reject) => {
    console.log("Starting server...");
    const server = app.listen(PORT, () => {
      console.log(`API server successfully started on port ${PORT}`);
      resolve(server);
    });
    server.on("error", (error) => {
      console.error("Erreur du serveur:", error);
      reject(error);
    });
  });
}

// Fonction pour fermer le serveur
function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        console.error("Error while closing the server", error);
        reject(error);
      } else {
        console.log("Server closed successfully");
        resolve();
      }
    });
  });
}

module.exports = { startServer, closeServer };
